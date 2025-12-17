"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";

interface AIToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelState: "idle" | "loading" | "ready" | "error";
  loadingProgress: {
    progress: number;
    text: string;
  };
  onInstall: () => Promise<void>;
}

export function AIToolsDialog({
  open,
  onOpenChange,
  modelState,
  loadingProgress,
  onInstall,
}: AIToolsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable AI Tools</DialogTitle>
          <DialogDescription>
            Download on-device AI for translation and more. The AI model (~500MB)
            will be cached locally for instant future use.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-48 h-48 mb-4">
            <AnimatedEmoji
              src="/translate/flags.json"
              size={192}
              playOnce={false}
            />
          </div>
          {modelState === "loading" && (
            <div className="w-full space-y-2">
              <div className="text-sm text-center text-muted-foreground">
                {loadingProgress.text}
              </div>
              <div className="text-2xl font-bold text-center">
                {loadingProgress.progress}%
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${loadingProgress.progress}%` }}
                />
              </div>
            </div>
          )}
          {modelState === "ready" && (
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                ✓ Complete!
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                AI tools are ready to use
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={modelState === "loading"}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (modelState === "ready") {
                // Already installed, just close
                onOpenChange(false);
              } else {
                // Install the model
                await onInstall();
              }
            }}
            disabled={modelState === "loading"}
          >
            {modelState === "loading"
              ? "Downloading..."
              : modelState === "ready"
                ? "Done"
                : "Download & Enable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
