"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Moon,
  Bell,
  Eye,
  Wifi,
  User,
  BarChart3,
  Heart,
  ChevronRight,
  Crown,
  CreditCard,
} from "lucide-react";

export default function SettingsPage() {
  // Appearance (dark mode)
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  // Greeting state
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setIsDark((resolvedTheme ?? theme) === "dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, theme]);

  useEffect(() => {
    const h = new Date().getHours();
    const g =
      h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    setGreeting(g);
  }, []);

  // Notifications (local UI state only — wire to real services later)
  const [pushEnabled, setPushEnabled] = useState(false);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);

  // Privacy
  const [showDistance, setShowDistance] = useState(true);
  const [appearOnline, setAppearOnline] = useState(true);

  return (
    <div className="mx-auto w-full max-w-xl p-4 pb-24 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=proximity"
            alt="User avatar"
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        </div>
        <div className="leading-tight">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <p className="text-lg font-semibold">Anthony</p>
        </div>
      </div>

      <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
        Membership
      </p>
      {/* Core gradient card */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-linear-to-br from-[#0a1a3f] via-[#0d1840] to-[#020617] text-primary-foreground shadow-2xl border border-white/10">
        <div className="relative z-10 flex flex-col items-start justify-between h-24">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
            Proximity
          </div>
          <div className="text-3xl font-extrabold text-foreground">Core</div>
          <div className="text-xs text-muted-foreground/80">
            Member since 2025
          </div>
        </div>
        <div className="absolute inset-0 bg-linear-to-br from-background/20 via-transparent to-background/30 opacity-40" />
      </div>
      <ul className="divide-y -mx-4 text-sm mt-1">
        <li className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Crown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium leading-tight">Upgrade to Max</p>
              <p className="text-xs text-muted-foreground">
                Access premium features and perks.
              </p>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </li>
        <li className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium leading-tight">Payment details</p>
              <p className="text-xs text-muted-foreground">
                Manage your billing and subscriptions.
              </p>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </li>
      </ul>
      {/* My profile */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          My profile
        </p>
        <ul className="divide-y -mx-4 text-sm">
          <li className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Edit profile</p>
                <p className="text-xs text-muted-foreground">
                  Update your personal information and bio.
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">My stats</p>
                <p className="text-xs text-muted-foreground">
                  View your engagement and activity insights.
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Heart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">My interests</p>
                <p className="text-xs text-muted-foreground">
                  Edit your hobbies and attraction preferences.
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </li>
        </ul>
      </section>
      {/* Appearance */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Appearance
        </p>
        <ul className="divide-y -mx-4">
          <li className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium leading-tight">Dark mode</p>
                <p className="text-xs text-muted-foreground">
                  Switch between light and dark themes.
                </p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => {
                setIsDark(checked);
                setTheme(checked ? "dark" : "light");
              }}
              aria-label="Toggle dark mode"
            />
          </li>
        </ul>
      </section>

      {/* Notifications */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Notifications
        </p>
        <ul className="divide-y -mx-4">
          <li className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="push">Enable push notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Stay updated with live app notifications.
                </p>
              </div>
            </div>
            <Switch
              id="push"
              checked={pushEnabled}
              onCheckedChange={setPushEnabled}
            />
          </li>
          <li className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="messages">Message alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Receive alerts for new messages.
                </p>
              </div>
            </div>
            <Switch
              id="messages"
              checked={messageAlerts}
              onCheckedChange={setMessageAlerts}
            />
          </li>
          <li className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="nearby">Nearby activity</Label>
                <p className="text-xs text-muted-foreground">
                  Be notified when users are near you.
                </p>
              </div>
            </div>
            <Switch
              id="nearby"
              checked={nearbyAlerts}
              onCheckedChange={setNearbyAlerts}
            />
          </li>
        </ul>
      </section>

      {/* Privacy */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Privacy
        </p>
        <ul className="divide-y -mx-4">
          <li className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="distance">Show my distance</Label>
                <p className="text-xs text-muted-foreground">
                  Display how far you are from other users.
                </p>
              </div>
            </div>
            <Switch
              id="distance"
              checked={showDistance}
              onCheckedChange={setShowDistance}
            />
          </li>
          <li className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="online">Appear online</Label>
                <p className="text-xs text-muted-foreground">
                  Control whether you appear active to others.
                </p>
              </div>
            </div>
            <Switch
              id="online"
              checked={appearOnline}
              onCheckedChange={setAppearOnline}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
