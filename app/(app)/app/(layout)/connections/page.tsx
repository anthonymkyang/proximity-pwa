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
import { AnimatePresence, motion } from "framer-motion";
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
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Check,
  ContactRound,
  Pin,
  MoreVertical,
  GripVertical,
  X,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { StatusBadge } from "@/components/status/Badge";
import * as Flags from "country-flag-icons/react/3x2";
import { SocialIcon } from "react-social-icons";

const baseFilters = ["All", "Contacts", "Pins", "Online", "Nearby"] as const;
const searchHints = [
  "by name",
  "by number",
  "for area",
  "what they're into",
  "for anything",
] as const;

type ConnectionRow = {
  id: string;
  type: "contact" | "pin";
  title: string;
  note?: string | null;
  category_id?: string | null;
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
  isContact?: boolean;
  isPin?: boolean;
  categoryId?: string | null;
};

type ConnectionCategory = {
  id: string;
  name: string;
  sort_order?: number | null;
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
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categories, setCategories] = useState<ConnectionCategory[]>([]);
  const [renameCategoryOpen, setRenameCategoryOpen] = useState(false);
  const [renameCategoryId, setRenameCategoryId] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState("");
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(
    null
  );
  const filterRowRef = useRef<HTMLDivElement>(null);
  const lastDragAtRef = useRef(0);
  const [addToCategoryOpen, setAddToCategoryOpen] = useState(false);
  const [addToCategoryId, setAddToCategoryId] = useState<string | null>(null);
  const [addingConnectionId, setAddingConnectionId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [query, setQuery] = useState("");
  const [searchHintIndex, setSearchHintIndex] = useState(0);
  const [searchHintCharIndex, setSearchHintCharIndex] = useState(0);
  const [searchHintDeleting, setSearchHintDeleting] = useState(false);
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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const currentHint = searchHints[searchHintIndex] || "";
    if (!searchHintDeleting) {
      if (searchHintCharIndex < currentHint.length) {
        timer = setTimeout(() => {
          setSearchHintCharIndex((prev) => prev + 1);
        }, 70);
      } else {
        timer = setTimeout(() => setSearchHintDeleting(true), 1600);
      }
    } else if (searchHintCharIndex > 0) {
      timer = setTimeout(() => {
        setSearchHintCharIndex((prev) => prev - 1);
      }, 45);
    } else {
      timer = setTimeout(() => {
        setSearchHintDeleting(false);
        setSearchHintIndex((prev) => (prev + 1) % searchHints.length);
      }, 200);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchHintCharIndex, searchHintDeleting, searchHintIndex]);

  const searchPlaceholder = useMemo(() => {
    const suffix = searchHints[searchHintIndex]?.slice(0, searchHintCharIndex);
    return suffix ? `Search ${suffix}` : "Search";
  }, [searchHintCharIndex, searchHintIndex]);
  const [canScrollBottom, setCanScrollBottom] = useState(false);
  const [listVisible, setListVisible] = useState(false);

  const filters = useMemo(
    () => [
      ...baseFilters,
      ...categories.map((category) => category.name),
      "+ Add",
    ],
    [categories]
  );
  const categoryByName = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      map.set(category.name, category.id);
    });
    return map;
  }, [categories]);

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

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const maxOrder =
        categories.length > 0
          ? Math.max(
              ...categories.map((category) => category.sort_order ?? 0)
            )
          : 0;
      const { data, error } = await supabase
        .from("connection_categories")
        .insert({ name, owner_id: user.id, sort_order: maxOrder + 1 })
        .select("id, name, sort_order")
        .single();
      if (error) throw error;
      setCategories((prev) => [...prev, data]);
      setActiveFilter(data.name);
      setAddToCategoryId(data.id);
      setAddToCategoryOpen(true);
      setAddCategoryOpen(false);
      setNewCategoryName("");
    } catch (err: any) {
      console.error("Failed to add label:", err?.message || err);
    }
  };

  const handleRenameCategory = async () => {
    const name = renameCategoryValue.trim();
    if (!renameCategoryId || !name) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("connection_categories")
        .update({ name })
        .eq("id", renameCategoryId);
      if (error) throw error;
      setCategories((prev) =>
        prev.map((category) =>
          category.id === renameCategoryId ? { ...category, name } : category
        )
      );
      if (categoryByName.get(activeFilter) === renameCategoryId) {
        setActiveFilter(name);
      }
      setRenameCategoryOpen(false);
      setRenameCategoryId(null);
      setRenameCategoryValue("");
    } catch (err: any) {
      console.error("Failed to rename label:", err?.message || err);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("connection_categories")
        .delete()
        .eq("id", deleteCategoryId);
      if (error) throw error;
      setCategories((prev) =>
        prev.filter((category) => category.id !== deleteCategoryId)
      );
      if (categoryByName.get(activeFilter) === deleteCategoryId) {
        setActiveFilter("All");
      }
      setDeleteCategoryOpen(false);
      setDeleteCategoryId(null);
    } catch (err: any) {
      console.error("Failed to delete label:", err?.message || err);
    }
  };

  const persistCategoryOrder = async (next: ConnectionCategory[]) => {
    try {
      const supabase = createClient();
      const payload = next.map((category, index) => ({
        id: category.id,
        sort_order: index + 1,
      }));
      const { error } = await supabase
        .from("connection_categories")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to reorder labels:", err?.message || err);
    }
  };

  const handleToggleCategory = async (
    connectionId: string,
    nextCategoryId: string | null
  ) => {
    try {
      setAddingConnectionId(connectionId);
      const supabase = createClient();
      const { error } = await supabase
        .from("connections")
        .update({ category_id: nextCategoryId })
        .eq("id", connectionId);
      if (error) throw error;
      setRows((prev) =>
        prev.map((row) =>
          row.id === connectionId ? { ...row, category_id: nextCategoryId } : row
        )
      );
    } catch (err: any) {
      console.error("Failed to update label:", err?.message || err);
    } finally {
      setAddingConnectionId(null);
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

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("connection_categories")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setCategories(data ?? []);
      } catch (err) {
        if (active) setCategories([]);
      }
    };
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!filters.includes(activeFilter)) {
      setActiveFilter("All");
    }
  }, [filters, activeFilter]);

  useEffect(() => {
    if (!categoryByName.has(activeFilter)) {
      setEditMode(false);
    }
  }, [activeFilter, categoryByName]);

  useEffect(() => {
    if (!editMode) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-edit-remove="true"]')
      ) {
        return;
      }
      setEditMode(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [editMode]);


  useEffect(() => {
    if (!reorderMode) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        filterRowRef.current &&
        event.target instanceof Node &&
        filterRowRef.current.contains(event.target)
      ) {
        return;
      }
      setReorderMode(false);
      setDraggingCategoryId(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [reorderMode]);

  const connections: UIConnection[] = useMemo(() => {
    // Build a map of profileIds to contacts for quick lookup
    const contactsByProfileId = new Map<string, any>();
    (rows || []).forEach((row) => {
      if (row.type === "contact") {
        const contact = Array.isArray(row.connection_contacts)
          ? row.connection_contacts[0]
          : row.connection_contacts;
        const contactProfile = contact?.profiles || null;
        const profileId =
          contact?.profile_id ||
          contactProfile?.id ||
          contact?.user_id ||
          contact?.contact_user_id ||
          contact?.contact_profile_id ||
          contact?.contact_id ||
          null;
        if (profileId) {
          contactsByProfileId.set(profileId, contact);
        }
      }
    });

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

      // For pins, check if this profileId also exists as a contact
      const contactForPin =
        row.type === "pin" && profileId
          ? contactsByProfileId.get(profileId)
          : null;
      const contactProfileForPin = contactForPin?.profiles || null;

      const avatarUrl = pinnedProfile?.avatar_url
        ? getAvatarProxyUrl(pinnedProfile.avatar_url)
        : contactProfile?.avatar_url
        ? getAvatarProxyUrl(contactProfile.avatar_url)
        : null;

      const title =
        pin?.nickname ||
        contact?.display_name ||
        contactForPin?.display_name ||
        pinnedProfile?.profile_title ||
        contactProfile?.profile_title ||
        contactProfileForPin?.profile_title ||
        row.title ||
        "Connection";

      const subtitle = (() => {
        const baseProfile =
          row.type === "pin" && contactProfileForPin
            ? contactProfileForPin
            : row.type === "pin"
            ? pinnedProfile
            : contactProfile;
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
        isContact: row.type === "contact",
        isPin: row.type === "pin",
        categoryId: row.category_id ?? null,
      };
    });
  }, [rows, presence, myCoords]);

  const dedupedConnectionsForCategory = useMemo(() => {
    const profileIdTypes = new Map<string, Set<"contact" | "pin">>();
    for (const conn of connections) {
      if (!conn.profileId) continue;
      if (!profileIdTypes.has(conn.profileId)) {
        profileIdTypes.set(conn.profileId, new Set());
      }
      profileIdTypes.get(conn.profileId)!.add(conn.type);
    }

    const seenProfileIds = new Map<string, UIConnection>();
    const list: UIConnection[] = [];
    for (const conn of connections) {
      if (!conn.profileId) {
        list.push(conn);
        continue;
      }
      const existing = seenProfileIds.get(conn.profileId);
      if (!existing) {
        seenProfileIds.set(conn.profileId, conn);
        const types = profileIdTypes.get(conn.profileId);
        conn.isContact = types?.has("contact") ?? false;
        conn.isPin = types?.has("pin") ?? false;
        list.push(conn);
      } else if (existing.type === "pin" && conn.type === "contact") {
        const types = profileIdTypes.get(conn.profileId);
        conn.isContact = types?.has("contact") ?? false;
        conn.isPin = types?.has("pin") ?? false;
        seenProfileIds.set(conn.profileId, conn);
        const idx = list.indexOf(existing);
        if (idx !== -1) list[idx] = conn;
      }
    }
    return list;
  }, [connections]);

  const filteredConnections = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = connections;

    const categoryId = categoryByName.get(activeFilter) || null;
    if (categoryId) {
      list = list.filter((c) => c.categoryId === categoryId);
    } else if (activeFilter === "Contacts") {
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
    } else if (activeFilter === "All") {
      list = dedupedConnectionsForCategory;
    }

    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle || "").toLowerCase().includes(q)
    );
  }, [
    connections,
    query,
    activeFilter,
    categoryByName,
    dedupedConnectionsForCategory,
  ]);

  useEffect(() => {
    if (loading) {
      setListVisible(false);
      return;
    }
    setListVisible(false);
    const frame = requestAnimationFrame(() => setListVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [activeFilter, filteredConnections.length, loading, error]);

  const toStatus = (
    presence: UIConnection["presence"]
  ): "online" | "away" | "offline" => {
    if (presence === "online") return "online";
    if (presence === "away" || presence === "recent") return "away";
    return "offline";
  };

  return (
    <>
      <div className="flex items-center gap-2 pb-2 px-4">
        <h1 className="flex-1 px-1 text-4xl font-extrabold tracking-tight">
          Connections
        </h1>
        {/* Actions moved to TopBar; leave space for layout if needed */}
      </div>

      {/* Search */}
      <div className="pb-5 px-4">
        <InputGroup className="border-0 shadow-none">
          <InputGroupInput
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Filter chips */}
      <div
        ref={filterRowRef}
        className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="pl-2.5"></div>
        {filters.map((f) => {
          const isAdd = f === "+ Add";
          const isAll = f === "All";
          const isActive = activeFilter === f;
          const categoryId = categoryByName.get(f) || null;
          const isCustom = Boolean(categoryId);
          if (isAdd) {
            return (
              <motion.div
                key={f}
                layout="position"
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              >
                <Drawer
                  open={addCategoryOpen}
                  onOpenChange={(open) => {
                    setAddCategoryOpen(open);
                    if (!open) setNewCategoryName("");
                  }}
                >
                  <DrawerTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-muted/40"
                    >
                      <span className="flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <div className="mx-auto w-full max-w-xl p-4 pb-6">
                      <DrawerHeader className="pt-0 px-0 pb-2">
                        <DrawerTitle>Add label</DrawerTitle>
                        <DrawerDescription>
                          Create a label to organise your connections.
                        </DrawerDescription>
                      </DrawerHeader>
                      <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                        <Label>Label</Label>
                        <Input
                          placeholder="e.g. Dom tops"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                      </div>
                      <DrawerFooter className="pt-4 px-0 pb-0">
                        <DrawerClose asChild>
                          <Button
                            disabled={!newCategoryName.trim()}
                            onClick={handleAddCategory}
                          >
                            Add label
                          </Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </div>
                  </DrawerContent>
                </Drawer>
              </motion.div>
            );
          }

          const handleDragStart = (event: React.DragEvent) => {
            if (!reorderMode || !isCustom || !categoryId) return;
            event.dataTransfer.setData("text/plain", categoryId);
            event.dataTransfer.effectAllowed = "move";
            setDraggingCategoryId(categoryId);
            lastDragAtRef.current = Date.now();
          };
          const handleDragOver = (event: React.DragEvent) => {
            if (!reorderMode || !isCustom || !categoryId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          };
          const handleDrop = () => {
            if (!reorderMode || !isCustom || !categoryId) return;
            if (!draggingCategoryId || draggingCategoryId === categoryId) {
              setDraggingCategoryId(null);
              return;
            }
            lastDragAtRef.current = Date.now();
            const next = [...categories];
            const fromIndex = next.findIndex((c) => c.id === draggingCategoryId);
            const toIndex = next.findIndex((c) => c.id === categoryId);
            if (fromIndex === -1 || toIndex === -1) {
              setDraggingCategoryId(null);
              return;
            }
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            setCategories(next);
            setDraggingCategoryId(null);
            void persistCategoryOrder(next);
          };

          return (
            <motion.div
              key={f}
              layout="position"
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <Button
                size="sm"
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "rounded-full",
                  isActive && "border border-primary",
                  isAll && "border-primary",
                  !isActive && "border-muted/40",
                  reorderMode && isCustom && "cursor-grab"
                )}
                onClick={() => {
                  if (reorderMode) {
                    const draggedRecently =
                      Date.now() - lastDragAtRef.current < 250;
                    if (!draggedRecently) {
                      setReorderMode(false);
                      setDraggingCategoryId(null);
                    }
                    if (draggedRecently) return;
                  }
                  setActiveFilter(f);
                }}
                draggable={reorderMode && isCustom}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <span className="flex items-center gap-1">
                  {f}
                  {reorderMode && isCustom ? (
                    <GripVertical className="h-3.5 w-3.5" />
                  ) : null}
                </span>
              </Button>
            </motion.div>
          );
        })}
        <div className="pr-2.5"></div>
      </div>

      {/* My Contact Card */}
      {activeFilter === "All" ? (
        <Drawer>
        <DrawerTrigger asChild>
          <div className="py-2 px-4 cursor-pointer">
            <div className="rounded-lg bg-card text-card-foreground hover:bg-muted transition-colors">
              <div className="p-4 flex items-center justify-between gap-4">
                <p className="font-semibold">My contact card</p>
                <Button size="sm" variant="outline">
                  My details
                </Button>
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
      ) : null}

      <Drawer
        open={addToCategoryOpen}
        onOpenChange={(open) => {
          setAddToCategoryOpen(open);
          if (!open) setAddToCategoryId(null);
        }}
      >
        <DrawerContent>
          <div className="mx-auto w-full max-w-xl p-4 pb-6">
            <DrawerHeader className="pt-0 px-0 pb-2">
              <DrawerTitle>Add connections</DrawerTitle>
              <DrawerDescription>
                Select contacts or pins to include in this label.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-2">
              {dedupedConnectionsForCategory.map((connection) => {
                const isAdded =
                  addToCategoryId != null &&
                  connection.categoryId === addToCategoryId;
                return (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={
                            connection.avatarUrl ||
                            (undefined as unknown as string)
                          }
                          alt={connection.title}
                        />
                        <AvatarFallback>{connection.fallback}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {connection.title}
                        </div>
                        {connection.subtitle ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {connection.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant={isAdded ? "secondary" : "outline"}
                      className="shrink-0"
                      disabled={addingConnectionId === connection.id}
                      onClick={() =>
                        handleToggleCategory(
                          connection.id,
                          isAdded ? null : addToCategoryId
                        )
                      }
                    >
                      {isAdded ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={renameCategoryOpen} onOpenChange={setRenameCategoryOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-xl p-4 pb-6">
            <DrawerHeader className="pt-0 px-0 pb-2">
              <DrawerTitle>Rename label</DrawerTitle>
            </DrawerHeader>
            <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Dom tops"
                value={renameCategoryValue}
                onChange={(e) => setRenameCategoryValue(e.target.value)}
              />
            </div>
            <DrawerFooter className="pt-4 px-0 pb-0">
              <DrawerClose asChild>
                <Button
                  disabled={!renameCategoryValue.trim()}
                  onClick={handleRenameCategory}
                >
                  Save
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-xl p-4 pb-6">
            <DrawerHeader className="pt-0 px-0 pb-2">
              <DrawerTitle>Delete label</DrawerTitle>
              <DrawerDescription>
                Connections will stay, but the label will be removed.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="pt-4 px-0 pb-0">
              <DrawerClose asChild>
                <Button variant="destructive" onClick={handleDeleteCategory}>
                  Delete label
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Connections list styled like Messages */}
      <div>
        {categoryByName.has(activeFilter) ? (
          <div className="flex items-center justify-between px-4 pb-2">
            <h2 className="text-xl font-semibold">{activeFilter}</h2>
            <div className="inline-flex w-fit gap-2">
              <Button
                variant="secondary"
                className="rounded-full h-9 w-9 p-0 focus-visible:z-10 backdrop-blur-2xl bg-white/10 dark:bg-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:bg-white/20 dark:hover:bg-white/10 transition-all"
                size="sm"
                aria-label="Add"
                onClick={() => {
                  const categoryId = categoryByName.get(activeFilter) || null;
                  setAddToCategoryId(categoryId);
                  setAddToCategoryOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    className="rounded-full h-9 w-9 p-0 focus-visible:z-10 backdrop-blur-2xl bg-white/10 dark:bg-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] hover:bg-white/20 dark:hover:bg-white/10 transition-all"
                    size="sm"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setEditMode(true)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const categoryId =
                        categoryByName.get(activeFilter) || null;
                      if (!categoryId) return;
                      const category = categories.find(
                        (c) => c.id === categoryId
                      );
                      setRenameCategoryId(categoryId);
                      setRenameCategoryValue(category?.name ?? activeFilter);
                      setRenameCategoryOpen(true);
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReorderMode((prev) => !prev)}
                  >
                    {reorderMode ? "Done reordering" : "Reorder"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      const categoryId =
                        categoryByName.get(activeFilter) || null;
                      if (!categoryId) return;
                      setDeleteCategoryId(categoryId);
                      setDeleteCategoryOpen(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : null}
        {loading ? null : (
          <div
            className={cn(
              "transition-[opacity,transform] duration-200 ease-out",
              listVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            {error ? (
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
                    ) : categoryByName.has(activeFilter) ? (
                      <>
                        <EmptyTitle>Nobody here yet</EmptyTitle>
                        <EmptyDescription>
                          Add connections to the list to start.
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
              <AnimatePresence initial={false} mode="popLayout">
                {filteredConnections.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="px-4"
                  >
                    <Link
                      href={`/app/connections/${c.id}`}
                      className="block"
                    >
                      <ListItemRow
                        left={
                          <div className="relative h-12 w-12">
                            <Avatar className="h-12 w-12">
                              <AvatarImage
                                src={
                                  c.avatarUrl ||
                                  (undefined as unknown as string)
                                }
                                alt={c.title}
                              />
                              <AvatarFallback>{c.fallback}</AvatarFallback>
                            </Avatar>
                            <StatusBadge
                              status={toStatus(c.presence)}
                              size="sm"
                              className="absolute -bottom-0.5 -right-0.5"
                            />
                          </div>
                        }
                        right={
                          <div className="flex items-center justify-between gap-3">
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
                            {categoryByName.has(activeFilter) && editMode ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full"
                        aria-label="Remove from label"
                        data-edit-remove="true"
                        disabled={addingConnectionId === c.id}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleToggleCategory(c.id, null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : activeFilter === "All" &&
                              (c.isContact || c.isPin) ? (
                              <div className="flex gap-1 ml-2 shrink-0">
                                {c.isContact ? (
                                  <span className="h-6 w-6 rounded-full bg-muted/60 text-muted-foreground inline-flex items-center justify-center">
                                    <ContactRound className="h-3.5 w-3.5" />
                                  </span>
                                ) : null}
                                {c.isPin ? (
                                  <span className="h-6 w-6 rounded-full bg-muted/60 text-muted-foreground inline-flex items-center justify-center">
                                    <Pin className="h-3.5 w-3.5 fill-current" />
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        }
                      />
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </>
  );
}
