// app/(auth)/auth/actions.tsx  (or .ts)
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/auth?error=${encodeURIComponent(
        error.message
      )}&email=${encodeURIComponent(email)}`
    );
  }

  // so /app re-renders with the user
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(
      `/auth?error=${encodeURIComponent(
        error.message
      )}&email=${encodeURIComponent(email)}`
    );
  }

  revalidatePath("/app", "layout");
  redirect("/app");
}
