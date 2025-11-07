"use client";

import Link from "next/link";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  ItemMedia,
  ItemGroup,
  ItemSeparator,
} from "@/components/ui/item";
import {
  User,
  Ruler,
  Heart,
  ShieldCheck,
  Image as ImageIcon,
  Images as ImagesIcon,
  Moon,
  Bell,
  Wifi,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import React from "react";
import { useEffect, useState } from "react";

export default function SettingsMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [messageAlerts, setMessageAlerts] = React.useState(true);
  const [nearbyAlerts, setNearbyAlerts] = React.useState(true);

  useEffect(() => {
    try {
      const p = window.localStorage.getItem("settings:push");
      const m = window.localStorage.getItem("settings:messages");
      const n = window.localStorage.getItem("settings:nearby");
      if (p !== null) setPushEnabled(p === "1");
      if (m !== null) setMessageAlerts(m === "1");
      if (n !== null) setNearbyAlerts(n === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("settings:push", pushEnabled ? "1" : "0");
    } catch {}
  }, [pushEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "settings:messages",
        messageAlerts ? "1" : "0"
      );
    } catch {}
  }, [messageAlerts]);
  useEffect(() => {
    try {
      window.localStorage.setItem("settings:nearby", nearbyAlerts ? "1" : "0");
    } catch {}
  }, [nearbyAlerts]);

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {/* My profile */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          My profile
        </p>
        <ItemGroup className="bg-card rounded-2xl">
          <Link href="/app/settings/edit-profile" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <User className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Edit profile</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <Link href="/app/settings/stats" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Ruler className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>My stats</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <Link href="/app/settings/into" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Heart className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>What I'm into</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <Link href="/app/settings/safer-sex" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <ShieldCheck className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Safer sex</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
        </ItemGroup>
      </section>

      {/* Media centre */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Media centre
        </p>
        <ItemGroup className="bg-card rounded-2xl">
          <Link href="/app/settings/photos/profile" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <ImageIcon className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Profile photos</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <Link href="/app/settings/albums" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <ImagesIcon className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Albums</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
        </ItemGroup>
      </section>

      {/* Appearance */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Appearance
        </p>
        <ItemGroup className="bg-card rounded-2xl">
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Moon className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Dark mode</ItemTitle>
            </ItemContent>
            <ItemActions>
              <div onClick={stop} onPointerDown={stop} onKeyDown={stop}>
                <Switch
                  id="switch-dark-mode"
                  name="switch-dark-mode"
                  checked={
                    mounted && (resolvedTheme === "dark" || theme === "dark")
                  }
                  onCheckedChange={(v) =>
                    setTheme(v === true ? "dark" : "light")
                  }
                  aria-label="Toggle dark mode"
                />
              </div>
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>
    </>
  );
}
