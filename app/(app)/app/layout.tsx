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

  const isMapPage = pathname === "/app";

  return (
    <div className="relative min-h-dvh">
      <div className="relative">
        {isMapPage ? (
          <>
            <MapCanvas className="absolute inset-0 z-0" />

            <div className="relative z-10">{children}</div>
          </>
        ) : (
          <div className="relative z-10 bg-background min-h-dvh">
            {children}
          </div>
        )}
      </div>
      <AppBar />
    </div>
  );
}
