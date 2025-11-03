// app/(app)/app/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import AppShell from "./AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return <AppShell>{children}</AppShell>;
}
