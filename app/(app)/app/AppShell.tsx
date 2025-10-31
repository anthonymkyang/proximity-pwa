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
        className={`relative z-10 min-h-screen pb-[calc(56px+env(safe-area-inset-bottom,0px))] ${
          isMapPage ? "bg-transparent pointer-events-none" : "bg-background"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={isMapPage ? "pointer-events-auto" : ""}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <AppBar />
    </div>
  );
}
