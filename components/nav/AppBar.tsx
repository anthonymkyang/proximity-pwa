"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Users, MessageCircle, User } from "lucide-react";

export default function AppBar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Explore", href: "/app", icon: Compass },
    { name: "Activity", href: "/app/activity", icon: Heart },
    { name: "Connections", href: "/app/connections", icon: Users },
    { name: "Messages", href: "/app/messages", icon: MessageCircle },
    { name: "Me", href: "/app/settings", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 text-card-foreground">
      <ul className="flex justify-between items-center py-2">
        {navItems.map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1 text-center">
              <Link
                href={href}
                className={`flex flex-col items-center text-[10px] transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
