// app/(auth)/auth/actions.tsx  (or .ts)
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function requestOtp(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string)?.trim();
  if (!email) {
    redirect(`/auth?error=${encodeURIComponent("Email is required.")}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(
      `/auth?error=${encodeURIComponent(
        error.message
      )}&email=${encodeURIComponent(email)}`
    );
  }

  redirect(`/auth?stage=verify&info=${encodeURIComponent("Code sent.")}&email=${encodeURIComponent(email)}`);
}

export async function verifyOtp(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string)?.trim();
  const token = (formData.get("token") as string)?.trim();

  if (!email || !token) {
    redirect(
      `/auth?stage=verify&error=${encodeURIComponent(
        "Enter the 6-digit code."
      )}&email=${encodeURIComponent(email ?? "")}`
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    redirect(
      `/auth?stage=verify&error=${encodeURIComponent(
        error.message
      )}&email=${encodeURIComponent(email)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id && email) {
    const fallbackName = email.split("@")[0] || "User";
    await supabase.from("profiles").insert(
      {
        id: user.id,
        name: fallbackName,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  revalidatePath("/app", "layout");
  redirect("/app");
}
