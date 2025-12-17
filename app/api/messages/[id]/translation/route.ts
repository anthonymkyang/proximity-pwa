// app/api/messages/[id]/translation/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Helper to extract message id robustly (Next 16 may pass params as a Promise)
async function getMessageId(
  req: Request,
  paramsOrPromise: { id?: string } | Promise<{ id?: string }>
) {
  const url = new URL(req.url);
  const tail = url.pathname.split("/").filter(Boolean).reverse()[1]; // Get second-to-last segment

  let pid: string | null = null;
  try {
    const ctx = (paramsOrPromise as any)?.then
      ? await (paramsOrPromise as Promise<{ id?: string }>)
      : (paramsOrPromise as { id?: string });
    const cid = ctx?.id;
    pid = cid && cid !== "undefined" ? String(cid) : null;
  } catch {
    // ignore; fall back to tail
  }

  const t = tail && tail !== "undefined" ? tail : null;
  return pid || t || null;
}

// PATCH /api/messages/:id/translation -> save translation for a message
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const messageId = await getMessageId(req, params);
  if (!messageId) {
    return NextResponse.json(
      { error: "message_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload = await req.json();
  const { translatedText, detectedLanguage, targetLanguage } = payload;

  if (!translatedText || !targetLanguage) {
    return NextResponse.json(
      { error: "translatedText and targetLanguage are required" },
      { status: 400 }
    );
  }

  // Verify message exists and user has access to it
  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .select("id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  if (msgErr || !message) {
    return NextResponse.json(
      { error: "Message not found" },
      { status: 404 }
    );
  }

  // Verify user is a member of the conversation
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", message.conversation_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Not authorized to access this message" },
      { status: 403 }
    );
  }

  // Update the translation
  const translation = {
    translatedText,
    detectedLanguage: detectedLanguage || null,
    targetLanguage,
  };

  const { error: updateErr } = await supabase
    .from("messages")
    .update({ translation })
    .eq("id", messageId);

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, translation }, { status: 200 });
}
