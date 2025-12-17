// hooks/useWebLLM.ts
import { useCallback, useRef, useState } from "react";
import * as webllm from "@mlc-ai/web-llm";

type ModelLoadingState = "idle" | "loading" | "ready" | "error";

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  targetLanguage: string;
}

interface ProgressInfo {
  progress: number;
  text: string;
}

const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export function useWebLLM() {
  const engineRef = useRef<webllm.MLCEngineInterface | null>(null);
  const [modelState, setModelState] = useState<ModelLoadingState>("idle");
  const [loadingProgress, setLoadingProgress] = useState<ProgressInfo>({
    progress: 0,
    text: "",
  });
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const checkModelCached = useCallback(async (): Promise<boolean> => {
    try {
      const hasModel = await webllm.hasModelInCache(SELECTED_MODEL);
      console.log(`[WebLLM] Model ${SELECTED_MODEL} cached:`, hasModel);
      return hasModel;
    } catch (error) {
      console.error("Error checking model cache:", error);
      return false;
    }
  }, []);

  const initializeModel = useCallback(async () => {
    // Return existing initialization promise if already in progress
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    // If already initialized, return immediately
    if (engineRef.current && modelState === "ready") {
      return Promise.resolve();
    }

    // Create new initialization promise
    const initPromise = (async () => {
      try {
        console.log("[WebLLM] Starting model initialization...");
        setModelState("loading");
        setLoadingProgress({ progress: 0, text: "Preparing to translate..." });

        const engine = await webllm.CreateMLCEngine(SELECTED_MODEL, {
          initProgressCallback: (report) => {
            console.log("[WebLLM] Progress:", report.text);
            // Extract progress percentage from the report
            const progressMatch = report.text.match(/(\d+)%/);
            const progress = progressMatch ? parseInt(progressMatch[1], 10) : 0;

            // Fun loading messages based on progress ranges
            let message = "Preparing to translate...";
            if (progress < 20) {
              message = "Warming up the AI brain...";
            } else if (progress < 40) {
              message = "Loading language models...";
            } else if (progress < 60) {
              message = "Almost there...";
            } else if (progress < 80) {
              message = "Give me a sec...";
            } else if (progress < 95) {
              message = "Final touches...";
            } else {
              message = "Ready to translate!";
            }

            setLoadingProgress({ progress, text: message });
          },
        });

        engineRef.current = engine;
        setModelState("ready");
        setLoadingProgress({ progress: 100, text: "" });
        console.log("[WebLLM] Model ready!");
      } catch (error) {
        console.error("Failed to initialize WebLLM:", error);
        setModelState("error");
        setLoadingProgress({ progress: 0, text: "Failed to load model" });
        engineRef.current = null;
        throw error;
      }
    })();

    initPromiseRef.current = initPromise;

    try {
      await initPromise;
    } finally {
      initPromiseRef.current = null;
    }
  }, [modelState]);

  const translateText = useCallback(
    async (
      text: string,
      targetLanguage: string = "English",
      sourceLanguage?: string
    ): Promise<TranslationResult> => {
      // Initialize model if needed
      await initializeModel();

      if (!engineRef.current) {
        throw new Error("Model not initialized");
      }

      const sourceInfo = sourceLanguage ? `The text is in ${sourceLanguage}.` : "Detect the source language.";

      const prompt = `You are a professional translator. ${sourceInfo} Translate it to ${targetLanguage}.

IMPORTANT RULES:
- Translate to natural, fluent ${targetLanguage}
- Preserve the original meaning and tone
- Keep any names, emojis, or special characters as-is
- If the text is already in ${targetLanguage}, output it unchanged
- Output ONLY the translated text, nothing else

Text:
${text}

${targetLanguage} translation:`;

      const response = await engineRef.current.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 512,
        top_p: 0.95,
      });

      const translatedText =
        response.choices[0]?.message?.content?.trim() || "";

      return {
        translatedText,
        targetLanguage,
      };
    },
    [initializeModel]
  );

  const detectLanguage = useCallback(
    async (text: string): Promise<string> => {
      await initializeModel();

      if (!engineRef.current) {
        throw new Error("Model not initialized");
      }

      const prompt = `Identify the language of the following text. Output ONLY the language name in English (e.g., "Spanish", "French", "Japanese"). Nothing else.

Text:
${text}`;

      const response = await engineRef.current.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0,
        max_tokens: 20,
      });

      return response.choices[0]?.message?.content?.trim() || "Unknown";
    },
    [initializeModel]
  );

  const askSemantic = useCallback(
    async (question: string, context: string): Promise<string> => {
      await initializeModel();

      if (!engineRef.current) {
        throw new Error("Model not initialized");
      }

      const prompt = `Based on the following conversation, answer the question. Be concise.

Conversation:
${context}

Question: ${question}

Answer:`;

      const response = await engineRef.current.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 256,
      });

      return response.choices[0]?.message?.content?.trim() || "";
    },
    [initializeModel]
  );

  const resetChat = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetChat();
    }
  }, []);

  return {
    modelState,
    loadingProgress,
    translateText,
    detectLanguage,
    askSemantic,
    resetChat,
    initializeModel,
    checkModelCached,
  };
}
