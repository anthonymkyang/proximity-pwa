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

export default function SettingsMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [messageAlerts, setMessageAlerts] = React.useState(true);
  const [nearbyAlerts, setNearbyAlerts] = React.useState(true);

  React.useEffect(() => {
    setIsDark((resolvedTheme ?? theme) === "dark");
  }, [resolvedTheme, theme]);

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
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => {
                  setIsDark(checked);
                  setTheme(checked ? "dark" : "light");
                }}
                aria-label="Toggle dark mode"
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      {/* Notifications */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Notifications
        </p>
        <ItemGroup className="bg-card border-b-accent-foreground rounded-2xl">
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Bell className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Enable push notifications</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                id="push"
                checked={pushEnabled}
                onCheckedChange={setPushEnabled}
              />
            </ItemActions>
          </Item>
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Bell className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Message alerts</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                id="messages"
                checked={messageAlerts}
                onCheckedChange={setMessageAlerts}
              />
            </ItemActions>
          </Item>
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Wifi className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Nearby activity</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                id="nearby"
                checked={nearbyAlerts}
                onCheckedChange={setNearbyAlerts}
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>
    </>
  );
}
