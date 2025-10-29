"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Ruler,
  Heart,
  ChevronRight,
  Crown,
  CreditCard,
  Pencil,
  Save,
  Shield,
  ShieldCheck,
  BadgeCheck,
  Download,
  Trash2,
  MapPin,
  Shuffle,
  ChevronDown,
  BookOpen,
  HelpCircle,
  Mail,
  Bug,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  ItemGroup,
  ItemSeparator,
} from "@/components/ui/item";

export default function SettingsPage() {
  // Appearance (dark mode)
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  // Greeting state
  const [greeting, setGreeting] = useState("Welcome back");

  const [name, setName] = useState("Anthony");
  const [editingName, setEditingName] = useState(false);

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
  const [showOnMap, setShowOnMap] = useState(true);

  // Membership card expand/collapse state
  const [cardOpen, setCardOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-xl p-4 pb-24 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarImage src="" alt="User avatar" />
            <AvatarFallback className="text-sm font-medium">AY</AvatarFallback>
          </Avatar>
        </div>
        <div className="leading-tight">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <div className="flex items-center gap-1">
            {editingName ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setName(e.currentTarget.textContent || name)}
                className="text-lg font-semibold outline-none border-none bg-transparent focus:ring-0"
              >
                {name}
              </span>
            ) : (
              <p className="text-lg font-semibold">{name}</p>
            )}
            <button
              type="button"
              onClick={() => setEditingName((v) => !v)}
              aria-label={editingName ? "Save name" : "Edit name"}
              className="ml-1 rounded p-1 hover:bg-muted transition text-muted-foreground"
            >
              {editingName ? (
                <Save className="h-4 w-4" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
        Membership
      </p>

      {/* Card stage: list header with peek + View card */}
      <div className="bg-card/70 backdrop-blur supports-backdrop-filter:bg-card/60 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium">Membership</div>
          <button
            type="button"
            onClick={() => setCardOpen(true)}
            className="text-primary text-sm font-medium inline-flex items-center gap-1"
            aria-label="View card"
          >
            View card
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Peek area – card pokes out of the top of the list container */}
        <div className="relative h-16">
          <div className="absolute left-4 right-4 -top-8">
            <div className="relative overflow-hidden rounded-xl aspect-85/54 w-full shadow-xl bg-linear-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-900">
              <div className="relative z-10 flex flex-col h-full">
                <div className="pl-3 pt-3">
                  <div className="text-xs uppercase tracking-wider text-slate-800/80 font-semibold">
                    Proximity
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight leading-tight mt-0.5">
                    Core
                  </div>
                </div>
                <div className="mt-auto pl-3 pb-3">
                  <div className="text-[11px] text-slate-800/80">
                    Member since 2025
                  </div>
                </div>
              </div>
              {/* Subtle noise overlay */}
              <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'><circle cx=\'1\' cy=\'1\' r=\'1\' fill=\'black\'/></svg>')] bg-size-[6px_6px]" />
              {/* Brushed overlays */}
              <div className="pointer-events-none absolute inset-0 opacity-30 -z-10 [background:repeating-linear-gradient(-45deg,rgba(255,255,255,0.35)_0px,rgba(255,255,255,0.35)_1px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_3px)]" />
              <div className="pointer-events-none absolute -top-8 -left-10 h-40 w-72 -rotate-12 rounded-full bg-white/30 blur-xl opacity-40 -z-10" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-black/20 blur-2xl opacity-60 -z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen expand modal when viewing the card */}
      {cardOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCardOpen(false)}
          />
          <div className="relative z-10 w-[min(92vw,420px)]">
            <div className="relative overflow-hidden rounded-xl aspect-85/54 w-full shadow-2xl border border-border bg-linear-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-900">
              <div className="relative z-10 flex flex-col h-full">
                <div className="pl-4 pt-4">
                  <div className="text-sm uppercase tracking-wider text-slate-800/80 font-semibold">
                    Proximity
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight leading-tight mt-1">
                    Core
                  </div>
                </div>
                <div className="mt-auto pl-4 pb-4">
                  <div className="text-xs text-slate-800/80">
                    Member since 2025
                  </div>
                </div>
              </div>
              {/* Subtle noise overlay */}
              <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'><circle cx=\'1\' cy=\'1\' r=\'1\' fill=\'black\'/></svg>')] bg-size-[6px_6px]" />
              {/* Brushed overlays */}
              <div className="pointer-events-none absolute inset-0 opacity-30 -z-10 [background:repeating-linear-gradient(-45deg,rgba(255,255,255,0.35)_0px,rgba(255,255,255,0.35)_1px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_3px)]" />
              <div className="pointer-events-none absolute -top-8 -left-10 h-40 w-72 -rotate-12 rounded-full bg-white/30 blur-xl opacity-40 -z-10" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-black/20 blur-2xl opacity-60 -z-10" />

              <button
                onClick={() => setCardOpen(false)}
                className="absolute -top-10 right-0 rounded-full bg-card/80 px-3 py-1 text-xs text-foreground shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions under membership header */}
      <ItemGroup className="border-y border-border -mx-4 -mt-8 relative z-10">
        <Item className="px-4 py-3">
          <ItemMedia variant="icon">
            <Crown className="h-4 w-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Upgrade to Max</ItemTitle>
            <ItemDescription>
              Access premium features and perks.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item className="px-4 py-3">
          <ItemMedia variant="icon">
            <CreditCard className="h-4 w-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Payment details</ItemTitle>
            <ItemDescription>
              Manage your billing and subscriptions.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </ItemActions>
        </Item>
      </ItemGroup>
      {/* My profile */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          My profile
        </p>
        <ItemGroup className="border-y border-border -mx-4">
          <Link href="/app/settings/edit-profile" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <User className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Edit profile</ItemTitle>
                <ItemDescription>
                  Update your profile title and bio.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/stats" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Ruler className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>My stats</ItemTitle>
                <ItemDescription>
                  Dick, measurements, and sexuality.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/into" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Heart className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>What I'm into</ItemTitle>
                <ItemDescription>
                  Kinks, fetishes, sex, and roleplay.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/safer-sex" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <ShieldCheck className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Safer sex</ItemTitle>
                <ItemDescription>
                  PrEP, testing, condoms, and consent.
                </ItemDescription>
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
        <ItemGroup className="border-y border-border -mx-4">
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Moon className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Dark mode</ItemTitle>
              <ItemDescription>
                Switch between light and dark themes.
              </ItemDescription>
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
        <ItemGroup className="border-y border-border -mx-4">
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Bell className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Enable push notifications</ItemTitle>
              <ItemDescription>
                Stay updated with live app notifications.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id="push"
                checked={pushEnabled}
                onCheckedChange={setPushEnabled}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Bell className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Message alerts</ItemTitle>
              <ItemDescription>
                Receive alerts for new messages.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id="messages"
                checked={messageAlerts}
                onCheckedChange={setMessageAlerts}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Wifi className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Nearby activity</ItemTitle>
              <ItemDescription>
                Be notified when users are near you.
              </ItemDescription>
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

      {/* Account */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Account
        </p>
        <ItemGroup className="border-y border-border -mx-4">
          <Link href="/app/settings/account/security" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Shield className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Login and security</ItemTitle>
                <ItemDescription>Password, 2FA, devices</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/account/verification" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <BadgeCheck className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Verification</ItemTitle>
                <ItemDescription>Prove it’s really you</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/account/data" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Download className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Download your data</ItemTitle>
                <ItemDescription>Get a copy of your data</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />
          <Link href="/app/settings/account/delete" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Trash2 className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Deactivate or delete account</ItemTitle>
                <ItemDescription>Take a break or leave</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
        </ItemGroup>
      </section>
      {/* Privacy */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Privacy
        </p>
        <ItemGroup className="border-y border-border -mx-4">
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Eye className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Show my distance</ItemTitle>
              <ItemDescription>
                Display how far you are from others.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id="distance"
                checked={showDistance}
                onCheckedChange={setShowDistance}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Eye className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Appear online</ItemTitle>
              <ItemDescription>
                Control whether you appear active.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id="online"
                checked={appearOnline}
                onCheckedChange={setAppearOnline}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <MapPin className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Show me on the map</ItemTitle>
              <ItemDescription>
                Show approximate location on the map.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id="showOnMap"
                checked={showOnMap}
                onCheckedChange={setShowOnMap}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item className="px-4 py-3">
            <ItemMedia variant="icon">
              <Shuffle className="h-4 w-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Randomise my location</ItemTitle>
              <ItemDescription>
                Obfuscate your exact position for privacy.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>
      {/* Help & support */}
      <section>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
          Help & support
        </p>
        <ItemGroup className="border-y border-border -mx-4">
          <Link href="/app/settings/help/guide" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <BookOpen className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Cruiser&apos;s guide to Proximity</ItemTitle>
                <ItemDescription>
                  How to get the most out of the app.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />

          <Link href="/app/settings/help/faqs" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <HelpCircle className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>FAQs</ItemTitle>
                <ItemDescription>Answers to common questions.</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />

          <Link href="/app/settings/help/contact" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Mail className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Contact Proximity</ItemTitle>
                <ItemDescription>
                  Reach out to our support team.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />

          <Link href="/app/settings/help/report" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Bug className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Report an issue</ItemTitle>
                <ItemDescription>
                  Tell us about a bug or problem.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
          <ItemSeparator />

          <Link href="/app/settings/help/feature-request" className="block">
            <Item className="px-4 py-3">
              <ItemMedia variant="icon">
                <Sparkles className="h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Request new features</ItemTitle>
                <ItemDescription>
                  Share ideas to make Proximity better.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ItemActions>
            </Item>
          </Link>
        </ItemGroup>
      </section>
    </div>
  );
}
