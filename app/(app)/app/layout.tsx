// app/(app)/app/layout.tsx  <-- make this a SERVER component (no "use client")
import { createClient } from "@/utils/supabase/server";
import AppShell from "./AppShell"; // a client shell that contains your current code

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // force server redirect
    return Response.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL),
      302
    );
    // or: redirect("/login") if you're using next/navigation in server comp
  }

  return <AppShell>{children}</AppShell>;
}
