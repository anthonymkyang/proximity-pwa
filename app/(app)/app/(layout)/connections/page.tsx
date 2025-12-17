"use client";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  AsYouType,
} from "libphonenumber-js/min";
import { useId, useRef } from "react";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Plus, Check } from "lucide-react";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Users, Smile, ChevronRight, Cake, MapPin, Phone } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectSeparator,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  usePresence,
  toUiPresence,
} from "@/components/providers/presence-context";
import * as Flags from "country-flag-icons/react/3x2";
import { SocialIcon } from "react-social-icons";

const filters = [
  "All",
  "Contacts",
  "Pins",
  "Online",
  "Nearby",
  "+ Add",
] as const;

type ConnectionRow = {
  id: string;
  type: "contact" | "pin";
  title: string;
  note?: string | null;
  connection_contacts?: any;
  connection_pins?: any;
  updated_at?: string | null;
};

type UIConnection = {
  id: string;
  type: "contact" | "pin";
  profileId?: string | null;
  title: string;
  subtitle: string | null;
  secondary?: string | null;
  presence?: "online" | "away" | "recent" | null;
  distanceKm?: number | null;
  nearEligible?: boolean;
  avatarUrl?: string | null;
  fallback: string;
};

// Reusable row layout similar to Messages list
function ListItemRow({
  left,
  right,
  className = "",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center gap-3 -mr-4 ${className}`}>
      <div className="relative h-12 w-12 grid place-items-center">{left}</div>
      <div className="min-w-0 flex-1 border-b border-b-muted py-3 pr-4">
        {right}
      </div>
    </div>
  );
}

// Age helper
function calcAge(dobStr?: string | null): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export default function ConnectionsPage() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [query, setQuery] = useState("");
  const { presence, currentUserId } = usePresence();
  const [nickname, setNickname] = useState("Anthony");
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myProfileError, setMyProfileError] = useState<string | null>(null);
  const [myContactDetails, setMyContactDetails] = useState<any>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    address: "",
    area: "",
    postcode: "",
  });
  // --- WhatsApp State ---
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("GB"); // Default to UK
  const [isWhatsappValid, setIsWhatsappValid] = useState(true);
  const whatsappInputId = useId();
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  // --- Social Media State ---
  const [instagram, setInstagram] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [telegram, setTelegram] = useState("");
  // --- Scroll state for gradients ---
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [canScrollTop, setCanScrollTop] = useState(false);
  const [canScrollBottom, setCanScrollBottom] = useState(false);

  const myCoords = useMemo(() => {
    if (!currentUserId) return null;
    const me = presence[currentUserId];
    if (me && typeof me.lat === "number" && typeof me.lng === "number") {
      return { lat: me.lat, lng: me.lng };
    }
    return null;
  }, [presence, currentUserId]);

  const TOP_COUNTRIES = [
    "GB",
    "US",
    "FR",
    "DE",
    "ES",
    "IT",
    "IE",
    "AU",
    "PL",
    "IN",
  ];

  const countryOptions = useMemo(() => {
    const allCountries = getCountries().map((countryCode) => {
      const callingCode = getCountryCallingCode(countryCode as any);
      const FlagComponent = (Flags as any)[countryCode];
      return {
        value: countryCode,
        label: `+${callingCode}`,
        Flag: FlagComponent,
        name: new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode),
      };
    });

    const top = allCountries
      .filter((c) => TOP_COUNTRIES.includes(c.value))
      .sort(
        (a, b) =>
          TOP_COUNTRIES.indexOf(a.value) - TOP_COUNTRIES.indexOf(b.value)
      );

    const rest = allCountries
      .filter((c) => !TOP_COUNTRIES.includes(c.value))
      .sort((a, b) => a.name!.localeCompare(b.name!));

    return { top, rest };
  }, [TOP_COUNTRIES]);

  const selectedCountryCallingCode = useMemo(
    () => getCountryCallingCode(selectedCountry as any),
    [selectedCountry]
  );

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;

    const run = async () => {
      try {
        if (!active) return;
        const supabase = createClient();
        const [
          { data: profileData, error: profileError },
          { data: contactData, error: contactError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("name, date_of_birth")
            .eq("id", currentUserId)
            .maybeSingle(),
          supabase
            .from("contact_details")
            .select(
              "address, area, postcode, whatsapp, instagram, x_handle, tiktok, telegram"
            )
            .eq("user_id", currentUserId)
            .maybeSingle(),
        ]);

        if (profileError) throw profileError;
        if (contactError) throw contactError;

        if (active) {
          setMyProfile(profileData);
          if (profileData?.name) {
            setNickname(profileData.name);
          }
          setMyProfileError(null);

          if (contactData) {
            setMyContactDetails(contactData);
            setLocationForm({
              address: contactData.address || "",
              area: contactData.area || "",
              postcode: contactData.postcode || "",
            });
            if (contactData.whatsapp) {
              const phoneNumber = parsePhoneNumberFromString(
                contactData.whatsapp
              );
              if (phoneNumber) {
                setSelectedCountry(phoneNumber.country || "GB");
                setWhatsappNumber(phoneNumber.formatNational());
              }
            }
            setInstagram(contactData.instagram || "");
            setXHandle(contactData.x_handle || "");
            setTiktok(contactData.tiktok || "");
            setTelegram(contactData.telegram || "");
          }
        }
      } catch (err: any) {
        if (!active) return;
        console.error("Error fetching my profile:", err);
        setMyProfileError(err.message || "Failed to load your profile");
      }
    };
    run();

    return () => {
      active = false;
    };
  }, [currentUserId]);

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    setCanScrollTop(scrollTop > 0);
    setCanScrollBottom(scrollTop < scrollHeight - clientHeight);
  };

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      // Initial check
      handleScroll();
      viewport.addEventListener("scroll", handleScroll);
      return () => viewport.removeEventListener("scroll", handleScroll);
    }
  }, [myContactDetails]); // Re-run when content might change

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const asYouType = new AsYouType(selectedCountry as any);
    const formatted = asYouType.input(input);
    const phoneNumber = asYouType.getNumber();

    setWhatsappNumber(formatted);
    setIsWhatsappValid(phoneNumber ? phoneNumber.isValid() : false);
  };

  const handleWhatsappPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    const phoneNumber = parsePhoneNumberFromString(pastedText);

    if (phoneNumber) {
      e.preventDefault();
      const country = phoneNumber.country;
      if (country) {
        setSelectedCountry(country || "GB");
        const asYouType = new AsYouType(country as any);
        const formatted = asYouType.input(phoneNumber.nationalNumber);
        setWhatsappNumber(formatted);
        setIsWhatsappValid(phoneNumber.isValid());
      }
    }
  };

  const handleSaveWhatsapp = async () => {
    if (!currentUserId) return;

    const phoneNumber = parsePhoneNumberFromString(
      whatsappNumber,
      selectedCountry as any
    );
    if (!phoneNumber || !phoneNumber.isValid()) {
      setIsWhatsappValid(false);
      return;
    }

    setIsSavingWhatsapp(true);
    try {
      const supabase = createClient();
      const internationalFormat = phoneNumber.format("E.164"); // e.g., +12133734253

      const { data, error } = await supabase
        .from("contact_details")
        .upsert(
          {
            user_id: currentUserId,
            whatsapp: internationalFormat,
          },
          { onConflict: "user_id", ignoreDuplicates: false }
        )
        .select()
        .single();

      if (error) throw new Error(JSON.stringify(error, null, 2));

      setMyContactDetails(data);
      document.getElementById("close-whatsapp-drawer")?.click();
    } catch (error: any) {
      console.error("Failed to save WhatsApp:", error.message || error);
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!currentUserId) return;
    setIsSavingLocation(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_details")
        .upsert(
          {
            user_id: currentUserId,
            address: locationForm.address || null,
            area: locationForm.area || null,
            postcode: locationForm.postcode || null,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw new Error(JSON.stringify(error, null, 2));
      setMyContactDetails(data);
      // Manually close the drawer by finding the button
      document.getElementById("close-location-drawer")?.click();
    } catch (error: any) {
      console.error("Failed to save location:", error.message || error);
    } finally {
      setIsSavingLocation(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/connections")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load connections");
        }
        return res.json();
      })
      .then((body) => {
        if (!active) return;
        setRows(body?.connections || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load connections");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const connections: UIConnection[] = useMemo(() => {
    return (rows || []).map((row) => {
      const contact = Array.isArray(row.connection_contacts)
        ? row.connection_contacts[0]
        : row.connection_contacts;
      const pin = Array.isArray(row.connection_pins)
        ? row.connection_pins[0]
        : row.connection_pins;
      const contactProfile = contact?.profiles || null;

      const pinnedProfile = pin?.pinned_profile || null;
      const profileId =
        (row.type === "pin"
          ? pin?.pinned_profile_id ||
            pinnedProfile?.id ||
            pin?.user_id ||
            pin?.pinned_user_id ||
            pin?.profile_id
          : contact?.profile_id ||
            contactProfile?.id ||
            contact?.user_id ||
            contact?.contact_user_id ||
            contact?.contact_profile_id ||
            contact?.contact_id ||
            null) || null;

      const avatarUrl = pinnedProfile?.avatar_url
        ? getAvatarProxyUrl(pinnedProfile.avatar_url)
        : contactProfile?.avatar_url
        ? getAvatarProxyUrl(contactProfile.avatar_url)
        : null;

      const title =
        pin?.nickname ||
        contact?.display_name ||
        pinnedProfile?.profile_title ||
        contactProfile?.profile_title ||
        row.title ||
        "Connection";

      const subtitle = (() => {
        const baseProfile = row.type === "pin" ? pinnedProfile : contactProfile;
        const age = calcAge(baseProfile?.date_of_birth);
        const position = baseProfile?.position?.label || null;
        const sexuality = baseProfile?.sexuality?.label || null;
        const parts = [age ? `${age}` : null, position, sexuality].filter(
          Boolean
        );
        return parts.join(" • ") || "";
      })();

      const secondary =
        row.type === "contact" ? contactProfile?.profile_title || null : null;

      const fallback = title.slice(0, 2).toUpperCase();

      return {
        id: row.id,
        type: row.type as "contact" | "pin",
        profileId,
        title,
        subtitle,
        secondary,
        avatarUrl,
        presence: (() => {
          return profileId ? toUiPresence(presence[profileId] as any) : null;
        })(),
        distanceKm: (() => {
          const pid = profileId;
          const coords =
            pid &&
            typeof presence[pid]?.lat === "number" &&
            typeof presence[pid]?.lng === "number"
              ? {
                  lat: presence[pid]!.lat as number,
                  lng: presence[pid]!.lng as number,
                }
              : null;
          const lastSeenStr = pid ? presence[pid]?.last_seen : null;
          if (lastSeenStr) {
            const lastSeen = Date.parse(lastSeenStr);
            if (Number.isFinite(lastSeen)) {
              const diffHours = (Date.now() - lastSeen) / 36e5;
              if (diffHours > 24) return null;
            }
          }
          if (!coords || !myCoords) return null;
          return distanceKm(myCoords, coords);
        })(),
        nearEligible: (() => {
          const pid = profileId;
          const coords =
            pid &&
            typeof presence[pid]?.lat === "number" &&
            typeof presence[pid]?.lng === "number"
              ? {
                  lat: presence[pid]!.lat as number,
                  lng: presence[pid]!.lng as number,
                }
              : null;
          const lastSeenStr = pid ? presence[pid]?.last_seen : null;
          if (!coords) return false;
          if (lastSeenStr) {
            const lastSeen = Date.parse(lastSeenStr);
            if (Number.isFinite(lastSeen)) {
              const diffHours = (Date.now() - lastSeen) / 36e5;
              if (diffHours > 24) return false;
            }
          }
          return true;
        })(),
        fallback,
      };
    });
  }, [rows, presence, myCoords]);

  const filteredConnections = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = connections;

    if (activeFilter === "Contacts") {
      list = list.filter((c) => c.type === "contact");
    } else if (activeFilter === "Pins") {
      list = list.filter((c) => c.type === "pin");
    } else if (activeFilter === "Online") {
      list = list.filter((c) => c.presence === "online");
    } else if (activeFilter === "Nearby") {
      list = list
        .filter((c) => c.nearEligible)
        .sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        );
    }

    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle || "").toLowerCase().includes(q)
    );
  }, [connections, query, activeFilter]);

  return (
    <>
      <div className="flex items-center gap-2 pb-2">
        <h1 className="flex-1 px-1 text-4xl font-extrabold tracking-tight">
          Connections
        </h1>
        {/* Actions moved to TopBar; leave space for layout if needed */}
      </div>

      {/* Search */}
      <div className="pb-5">
        <InputGroup>
          <InputGroupInput
            placeholder="Search connections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => {
          const isAdd = f === "+ Add";
          const isAll = f === "All";
          const isActive = activeFilter === f;
          return (
            <Button
              key={f}
              size="sm"
              variant={isActive ? "default" : "outline"}
              className={cn(
                "rounded-full",
                isActive && "border border-primary",
                isAll && "border-primary"
              )}
              onClick={() => setActiveFilter(f)}
            >
              {isAdd ? (
                <span className="flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </span>
              ) : (
                f
              )}
            </Button>
          );
        })}
      </div>

      {/* My Contact Card */}
      <Drawer>
        <DrawerTrigger asChild>
          <div className="py-2 cursor-pointer">
            <div className="border rounded-lg bg-card text-card-foreground hover:bg-muted transition-colors">
              <div className="p-4 flex items-center justify-between gap-4">
                <p className="font-semibold">My contact card</p>
              </div>
            </div>
          </div>
        </DrawerTrigger>
        <DrawerContent>
          <div className="mx-auto w-full max-w-xl p-4 pb-6">
            <DrawerHeader className="pt-0 px-0 pb-2">
              <DrawerTitle>My card</DrawerTitle>
            </DrawerHeader>
            <div className="relative">
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent transition-opacity pointer-events-none",
                  canScrollTop ? "opacity-100" : "opacity-0"
                )}
              />
              <ScrollArea
                className="h-[60vh] -mx-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                ref={scrollViewportRef}
              >
                <div className="px-1">
                  <ItemGroup className="bg-card rounded-2xl">
                    <Drawer>
                      <DrawerTrigger asChild>
                        <Item className="px-4 py-3 cursor-pointer">
                          <ItemMedia variant="icon">
                            <Smile className="h-4 w-4" />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>Nickname</ItemTitle>
                          </ItemContent>
                          <ItemActions className="gap-2">
                            <span className="text-sm text-muted-foreground">
                              {nickname}
                            </span>
                            <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                          </ItemActions>
                        </Item>
                      </DrawerTrigger>
                      <DrawerContent>
                        <div className="mx-auto w-full max-w-xl p-4 pb-6">
                          <DrawerHeader className="pt-0 px-0 pb-4">
                            <DrawerTitle>Edit nickname</DrawerTitle>
                          </DrawerHeader>
                          <Input defaultValue={nickname} />
                          <DrawerFooter className="pt-6 px-0 pb-0">
                            <Button>Save</Button>
                            <DrawerClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DrawerClose>
                          </DrawerFooter>
                        </div>
                      </DrawerContent>
                    </Drawer>
                    <Item className="px-4 py-3">
                      <ItemMedia variant="icon">
                        <Cake className="h-4 w-4" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>Age</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <span className="text-sm text-muted-foreground">
                          {myProfileError
                            ? "Error"
                            : myProfile
                            ? calcAge(myProfile.date_of_birth) ?? "Not set"
                            : "..."}
                        </span>
                      </ItemActions>
                    </Item>
                    <Drawer>
                      <DrawerTrigger asChild>
                        <Item className="px-4 py-3 cursor-pointer">
                          <ItemMedia variant="icon">
                            <Phone className="h-4 w-4" />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>WhatsApp</ItemTitle>
                          </ItemContent>
                          <ItemActions className="gap-2">
                            <span className="text-sm text-muted-foreground">
                              {myContactDetails?.whatsapp || "Not set"}
                            </span>
                            <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                          </ItemActions>
                        </Item>
                      </DrawerTrigger>
                      <DrawerContent>
                        <div className="mx-auto w-full max-w-xl p-4 pb-6">
                          <DrawerHeader className="pt-0 px-0 pb-4">
                            <DrawerTitle>Edit WhatsApp</DrawerTitle>
                          </DrawerHeader>
                          <InputGroup>
                            <InputGroupAddon className="pr-0">
                              <Select
                                value={selectedCountry}
                                onValueChange={setSelectedCountry}
                              >
                                <SelectTrigger className="w-20 rounded-r-none focus:ring-0 focus:ring-offset-0 border-0 bg-transparent">
                                  <SelectValue asChild>
                                    <div className="flex items-center gap-2">
                                      {(Flags as any)[selectedCountry] &&
                                        React.createElement(
                                          (Flags as any)[selectedCountry],
                                          { className: "h-4 w-6" }
                                        )}
                                    </div>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[50vh]">
                                  {countryOptions.top.map(
                                    ({ value, label, Flag, name }) => (
                                      <SelectItem key={value} value={value}>
                                        <div className="flex items-center gap-2">
                                          {Flag && <Flag className="h-4 w-6" />}
                                          <span>
                                            {name} ({label})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    )
                                  )}
                                  <SelectSeparator />
                                  {countryOptions.rest.map(
                                    ({ value, label, Flag, name }) => (
                                      <SelectItem key={value} value={value}>
                                        <div className="flex items-center gap-2">
                                          {Flag && <Flag className="h-4 w-6" />}
                                          <span>
                                            {name} ({label})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </InputGroupAddon>
                            <InputGroupInput
                              id={whatsappInputId}
                              type="tel"
                              placeholder="Phone number"
                              value={whatsappNumber}
                              onChange={handleWhatsappChange}
                              onPaste={handleWhatsappPaste}
                              className="peer"
                              aria-invalid={!isWhatsappValid || undefined}
                            />
                          </InputGroup>
                          <p className="text-xs text-muted-foreground peer-aria-invalid:text-destructive pt-1">
                            {!isWhatsappValid && whatsappNumber
                              ? "Please enter a valid phone number."
                              : "Your number will only be shared with your contacts."}
                          </p>
                          <DrawerFooter className="pt-6 px-0 pb-0">
                            <Button
                              onClick={handleSaveWhatsapp}
                              disabled={
                                isSavingWhatsapp ||
                                !isWhatsappValid ||
                                !whatsappNumber
                              }
                            >
                              {isSavingWhatsapp ? "Saving..." : "Save"}
                            </Button>
                            <DrawerClose asChild id="close-whatsapp-drawer">
                              <Button variant="outline">Cancel</Button>
                            </DrawerClose>
                          </DrawerFooter>
                        </div>
                      </DrawerContent>
                    </Drawer>
                    <Drawer>
                      <DrawerTrigger
                        asChild
                        onClick={() => {
                          // Reset form to latest db state on open
                          setLocationForm({
                            address: myContactDetails?.address || "",
                            area: myContactDetails?.area || "",
                            postcode: myContactDetails?.postcode || "",
                          });
                        }}
                      >
                        <Item className="px-4 py-3 cursor-pointer">
                          <ItemMedia variant="icon">
                            <MapPin className="h-4 w-4" />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>Location</ItemTitle>
                          </ItemContent>
                          <ItemActions className="gap-2">
                            <span className="text-sm text-muted-foreground">
                              {myContactDetails?.area ||
                                myContactDetails?.address ||
                                myContactDetails?.postcode ||
                                "Not set"}
                            </span>
                            <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                          </ItemActions>
                        </Item>
                      </DrawerTrigger>
                      <DrawerContent>
                        <div className="mx-auto w-full max-w-xl p-4 pb-6">
                          <DrawerHeader className="pt-0 px-0 pb-4">
                            <DrawerTitle>Edit location</DrawerTitle>
                          </DrawerHeader>
                          <div className="space-y-4">
                            <Input
                              placeholder="Address"
                              value={locationForm.address}
                              onChange={(e) =>
                                setLocationForm({
                                  ...locationForm,
                                  address: e.target.value,
                                })
                              }
                            />
                            <Input
                              placeholder="Area"
                              value={locationForm.area}
                              onChange={(e) =>
                                setLocationForm({
                                  ...locationForm,
                                  area: e.target.value,
                                })
                              }
                            />
                            <Input
                              placeholder="Postcode"
                              value={locationForm.postcode}
                              onChange={(e) =>
                                setLocationForm({
                                  ...locationForm,
                                  postcode: e.target.value,
                                })
                              }
                            />
                          </div>
                          <DrawerFooter className="pt-6 px-0 pb-0">
                            <Button
                              onClick={handleSaveLocation}
                              disabled={isSavingLocation}
                            >
                              {isSavingLocation ? "Saving..." : "Save"}
                            </Button>
                            <DrawerClose asChild id="close-location-drawer">
                              <Button variant="outline">Cancel</Button>
                            </DrawerClose>
                          </DrawerFooter>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </ItemGroup>

                  {/* Social Media Section */}
                  <div className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2">
                      Social media
                    </h3>
                    <ItemGroup className="bg-card rounded-2xl">
                      {/* Instagram */}
                      <Drawer>
                        <DrawerTrigger asChild>
                          <Item className="px-4 py-3 cursor-pointer">
                            <ItemMedia variant="icon">
                              <SocialIcon
                                network="instagram"
                                style={{ height: 24, width: 24 }}
                              />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>Instagram</ItemTitle>
                            </ItemContent>
                            <ItemActions className="gap-2">
                              <span className="text-sm text-muted-foreground">
                                {instagram || "Not set"}
                              </span>
                              <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                            </ItemActions>
                          </Item>
                        </DrawerTrigger>
                        <DrawerContent>
                          {/* Drawer content for Instagram can be added here */}
                        </DrawerContent>
                      </Drawer>

                      {/* X */}
                      <Drawer>
                        <DrawerTrigger asChild>
                          <Item className="px-4 py-3 cursor-pointer">
                            <ItemMedia variant="icon">
                              <SocialIcon
                                network="x"
                                style={{ height: 24, width: 24 }}
                              />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>X</ItemTitle>
                            </ItemContent>
                            <ItemActions className="gap-2">
                              <span className="text-sm text-muted-foreground">
                                {xHandle || "Not set"}
                              </span>
                              <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                            </ItemActions>
                          </Item>
                        </DrawerTrigger>
                        <DrawerContent>
                          {/* Drawer content for X can be added here */}
                        </DrawerContent>
                      </Drawer>

                      {/* TikTok */}
                      <Drawer>
                        <DrawerTrigger asChild>
                          <Item className="px-4 py-3 cursor-pointer">
                            <ItemMedia variant="icon">
                              <SocialIcon
                                network="tiktok"
                                style={{ height: 24, width: 24 }}
                              />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>TikTok</ItemTitle>
                            </ItemContent>
                            <ItemActions className="gap-2">
                              <span className="text-sm text-muted-foreground">
                                {tiktok || "Not set"}
                              </span>
                              <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                            </ItemActions>
                          </Item>
                        </DrawerTrigger>
                        <DrawerContent>
                          {/* Drawer content for TikTok can be added here */}
                        </DrawerContent>
                      </Drawer>

                      {/* Telegram */}
                      <Drawer>
                        <DrawerTrigger asChild>
                          <Item className="px-4 py-3 cursor-pointer">
                            <ItemMedia variant="icon">
                              <SocialIcon
                                network="telegram"
                                style={{ height: 24, width: 24 }}
                              />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>Telegram</ItemTitle>
                            </ItemContent>
                            <ItemActions className="gap-2">
                              <span className="text-sm text-muted-foreground">
                                {telegram || "Not set"}
                              </span>
                              <ChevronRight className="h-3.5 w-4.5 text-muted-foreground" />
                            </ItemActions>
                          </Item>
                        </DrawerTrigger>
                        <DrawerContent>
                          {/* Drawer content for Telegram can be added here */}
                        </DrawerContent>
                      </Drawer>
                    </ItemGroup>
                  </div>
                </div>
              </ScrollArea>
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent transition-opacity pointer-events-none",
                  canScrollBottom ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Connections list styled like Messages */}
      <div className="-mx-4">
        {loading ? null : error ? (
          <div className="px-4 text-sm text-muted-foreground">{error}</div>
        ) : filteredConnections.length === 0 ? (
          <div className="pt-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="h-6 w-6" />
                </EmptyMedia>
                {activeFilter === "Contacts" ? (
                  <>
                    <EmptyTitle>No contacts yet</EmptyTitle>
                    <EmptyDescription>
                      Add people you’ve exchanged details with to see them here.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Pins" ? (
                  <>
                    <EmptyTitle>No pinned profiles</EmptyTitle>
                    <EmptyDescription>
                      Pin profiles you like to keep them handy.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Online" ? (
                  <>
                    <EmptyTitle>No one online right now</EmptyTitle>
                    <EmptyDescription>
                      Check back soon or pin more profiles to grow this list.
                    </EmptyDescription>
                  </>
                ) : activeFilter === "Nearby" ? (
                  <>
                    <EmptyTitle>No nearby connections</EmptyTitle>
                    <EmptyDescription>
                      Try again later or adjust your filters.
                    </EmptyDescription>
                  </>
                ) : (
                  <>
                    <EmptyTitle>No connections yet</EmptyTitle>
                    <EmptyDescription>
                      Pin profiles you like or add contacts after exchanging
                      details.
                    </EmptyDescription>
                  </>
                )}
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          filteredConnections.map((c) => (
            <Link
              key={c.id}
              href={
                c.type === "contact" && c.id
                  ? `/app/connections/${c.id}`
                  : c.type === "pin" && c.profileId
                  ? `/app/profile/${c.profileId}`
                  : `/app/connections/${c.id}`
              }
              className="block px-4"
            >
              <ListItemRow
                left={
                  <div className="relative h-12 w-12">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={c.avatarUrl || (undefined as unknown as string)}
                        alt={c.title}
                      />
                      <AvatarFallback>{c.fallback}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 z-10 block h-2.5 w-2.5 rounded-full ring ring-background transition-all duration-200",
                        c.presence
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-75",
                        c.presence === "online"
                          ? "bg-green-500"
                          : c.presence === "recent"
                          ? "bg-muted-foreground"
                          : "bg-transparent"
                      )}
                    />
                  </div>
                }
                right={
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold max-w-[60vw] sm:max-w-[70vw]">
                          <span className="truncate inline-block max-w-[48vw] align-middle">
                            {c.title}
                          </span>
                          {c.secondary ? (
                            <span className="pl-2 text-sm font-normal text-muted-foreground truncate inline-block max-w-[32vw] align-middle">
                              {c.secondary}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        {c.subtitle ? (
                          <span className="truncate">{c.subtitle}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                }
              />
            </Link>
          ))
        )}
      </div>
    </>
  );
}
