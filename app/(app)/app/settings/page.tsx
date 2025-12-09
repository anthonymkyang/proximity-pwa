"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsMenu from "@/components/settings/SettingsMenu";
import SettingsHeader from "@/components/settings/SettingsHeader";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl p-4 pb-24 space-y-10">
      <SettingsHeader />

      <div className="flex flex-col items-center gap-3">
        <p className="self-start text-xs font-semibold tracking-wider text-muted-foreground mb-0 uppercase">
          Membership
        </p>
        <div className="grid w-full grid-cols-[1fr_2fr] items-start gap-4">
          <div className="flex justify-center md:justify-start">
            <div className="relative w-full max-w-[320px] aspect-[8560/5398]">
              <div className="relative h-full w-full overflow-hidden rounded-[12px] border border-white/10 bg-[radial-gradient(circle_at_40%_30%,#14151b,#0e0f14_65%)] shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
                <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 text-white/70">
                  <span className="text-[10px] md:text-[11px] font-semibold tracking-[0.08em]">
                    Proximity
                  </span>
                  <span className="text-[12px] md:text-[13px] font-semibold tracking-[0.04em] uppercase -mt-2">
                    Ambassador
                  </span>
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)] opacity-70" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(255,255,255,0.05),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.03),transparent_55%)]" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">Ambassador</p>
              <span className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#f6f7f9,#d1d5dc)] px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                Lifetime
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Exp: Lifetime
              <br />
              Points: 3420
            </p>
          </div>
        </div>

        <div className="w-full">
          <ItemGroup className="bg-card rounded-2xl">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <CreditCard className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Payment details</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </ItemGroup>
        </div>
      </div>

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
