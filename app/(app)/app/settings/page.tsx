"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsMenu from "@/components/settings/SettingsMenu";
import Membership from "@/components/settings/Membership";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl p-4 pb-24 space-y-8">
      <SettingsHeader />

      <Membership />

      <SettingsMenu />

      {/* View profile */}
      <div className="pt-2">
        <Button asChild variant="secondary" className="w-full">
          <Link href="/app/profile/me">View my profile</Link>
        </Button>
      </div>

      {/* Logout */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } finally {
              window.location.href = "/auth";
            }
          }}
          aria-label="Log out"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Proximity v0.1.0-alpha
        </p>
      </div>
    </div>
  );
}
