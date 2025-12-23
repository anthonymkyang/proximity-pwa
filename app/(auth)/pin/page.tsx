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

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <PinSetupClient />
    </main>
  );
}
