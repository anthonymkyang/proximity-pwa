"use client";

import { usePathname } from "next/navigation";
import MapCanvas from "@/components/map/MapCanvas";
import AppBar from "@/components/nav/AppBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/app";

  return (
    <div className="relative min-h-screen">
      {/* fixed, always mounted map */}
      <div className="fixed inset-0 z-0">
        <MapCanvas />
      </div>

      {/* content layer */}
      <main
        className={`relative z-10 min-h-screen pb-[calc(56px+env(safe-area-inset-bottom,0px))] ${
          isMapPage
            ? "bg-transparent pointer-events-none" // don't block the map
            : "bg-background"
        }`}
      >
        {/* re-enable pointers for actual UI on /app */}
        <div className={isMapPage ? "pointer-events-auto" : ""}>{children}</div>
      </main>

      {/* bottom nav */}
      <AppBar />
    </div>
  );
}
