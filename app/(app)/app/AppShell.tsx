// app/(app)/app/AppShell.tsx
"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import MapCanvas from "@/components/map/MapCanvas";
import AppBar from "@/components/nav/AppBar";

// app/(app)/app/AppShell.tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/app";

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <MapCanvas />
      </div>
      <main
        className={`relative z-10 min-h-screen max-h-screen overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] ${
          isMapPage ? "bg-transparent pointer-events-none" : "bg-background"
        }`}
      >
        <div className={isMapPage ? "pointer-events-auto" : ""}>{children}</div>
      </main>
      <AppBar />
    </div>
  );
}
