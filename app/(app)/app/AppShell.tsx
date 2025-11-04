// app/(app)/app/AppShell.tsx
"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import MapCanvas from "@/components/map/MapCanvas";
import AppBar from "@/components/nav/AppBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/app";

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <MapCanvas />
      </div>
      <main
        className={`relative min-h-[calc(100-screen-56px)] overflow-y-auto ${
          isMapPage ? "bg-transparent pointer-events-none" : "bg-background"
        }`}
      >
        <div className={isMapPage ? "pointer-events-auto" : ""}>{children}</div>
      </main>
      <AppBar />
    </div>
  );
}
