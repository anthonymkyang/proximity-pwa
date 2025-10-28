"use client";

import { usePathname } from "next/navigation";
import { Compass, Heart, Users, MessageCircle, User } from "lucide-react";
import AppBar from "@/components/nav/AppBar";
import MapCanvas from "@/components/map/MapCanvas";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Explore", href: "/app", icon: Compass },
    { name: "Activity", href: "/app/activity", icon: Heart },
    { name: "Connections", href: "/app/connections", icon: Users },
    { name: "Messages", href: "/app/messages", icon: MessageCircle },
    { name: "Me", href: "/app/settings", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="relative flex-1 overflow-hidden min-h-[calc(100dvh-56px)] supports-[height:100svh]:min-h-[calc(100svh-56px)]">
        {/* Mock map background */}
        <MapCanvas />

        {/* Page content overlay */}
        <div
          className={`relative z-10 h-full w-full overflow-auto pb-[calc(56px+env(safe-area-inset-bottom))] ${
            pathname !== "/app" ? "bg-background" : ""
          }`}
        >
          {children}
        </div>
      </main>
      <AppBar />
    </div>
  );
}
