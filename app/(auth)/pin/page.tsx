import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PinSetupClient from "./PinSetupClient";

export default async function PinSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: backupRow } = await supabase
    .from("user_key_backups")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (backupRow) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <PinSetupClient />
    </main>
  );
}
