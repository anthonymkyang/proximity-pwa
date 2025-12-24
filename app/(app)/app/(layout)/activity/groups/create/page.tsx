"use client";

import * as React from "react";
import { useId } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  X,
  XCircle,
  LogOut,
  UserPlus,
  Users,
  Zap,
  Utensils,
  Palette,
  Gamepad2,
  BookOpen,
  ChevronDownIcon,
  Minus,
  Plus,
  Infinity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import maplibregl, {
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import TextareaAutosize from "react-textarea-autosize";
import ImageEditor from "@/components/images/ImageEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";

export const dynamic = "force-dynamic";

const STORAGE_KEY = "create-group-progress";

const CATEGORY_ORDER = [
  "Pump n dump",
  "Orgie",
  "Group sex",
  "Bukkake",
  "Circle jerk",
  "Gloryhole",
  "Outdoors",
];

const resolveCoverUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.replace(/^\/+/g, "").replace(/^group-media\//i, "");
  return `/api/groups/storage?bucket=group-media&path=${encodeURIComponent(
    normalized
  )}`;
};

const initialsFrom = (text?: string | null) => {
  if (!text) return "U";
  const trimmed = String(text).trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last || first || "U").toUpperCase().slice(0, 2);
};

const isLatLngText = (value?: string | null) => {
  if (!value) return false;
  return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(value);
};

type GroupCategory = {
  id: string;
  name: string;
};

type Person = {
  id: string;
  username: string;
  profile_title?: string | null;
  avatar_url?: string | null;
};

const truncatedLabel = (value: string, max = 24) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

type GroupFormData = {
  title: string;
  description: string;
  category_id: string;
  start_time: string;
  end_time: string;
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  postcode: string;
  additional_details: string;
  display_details_on_day: boolean;
  max_attendees: string;
  house_rules: string[];
  provided_items: string[];
  is_public: boolean;
  show_on_map: boolean;
  cover_image_url: string | null;
  cohost_ids: string[];
};

export default function CreateGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<GroupCategory[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<
    (() => void) | null
  >(null);
  const [categoriesLoading, setCategoriesLoading] = React.useState(true);
  const [coverImagePreview, setCoverImagePreview] = React.useState<
    string | null
  >(null);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [imageEditorOpen, setImageEditorOpen] = React.useState(false);
  const [initialImageSrc, setInitialImageSrc] = React.useState<string | null>(
    null
  );
  const hasHydratedRef = React.useRef(false);
  const [cohostSuggestions, setCohostSuggestions] = React.useState<Person[]>(
    []
  );
  const [cohostProfiles, setCohostProfiles] = React.useState<
    Record<string, Person>
  >({});
  const [cohostLoading, setCohostLoading] = React.useState(false);

  const [formData, setFormData] = React.useState<GroupFormData>({
    title: "",
    description: "",
    category_id: "",
    start_time: "",
    end_time: "",
    location_text: "",
    location_lat: null,
    location_lng: null,
    postcode: "",
    additional_details: "",
    display_details_on_day: false,
    max_attendees: "",
    house_rules: [""],
    provided_items: [""],
    is_public: true,
    show_on_map: true,
    cover_image_url: null,
    cohost_ids: [],
  });
  const [publishedStatus, setPublishedStatus] = React.useState(true);
  const selectedCohosts = React.useMemo(
    () =>
      (formData.cohost_ids || [])
        .map((id) => cohostProfiles[id])
        .filter(Boolean) as Person[],
    [formData.cohost_ids, cohostProfiles]
  );
  const filteredCohostSuggestions = React.useMemo(
    () =>
      cohostSuggestions
        .filter((person) => !(formData.cohost_ids || []).includes(person.id))
        .slice(0, 14),
    [cohostSuggestions, formData.cohost_ids]
  );
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("18:00");
  const [locationArea, setLocationArea] = React.useState<string | null>(null);
  const [openStartDate, setOpenStartDate] = React.useState(false);
  const [openEndDate, setOpenEndDate] = React.useState(false);
  const [noEndTime, setNoEndTime] = React.useState(false);
  const [startTimeError, setStartTimeError] = React.useState<string | null>(
    null
  );
  const [endTimeError, setEndTimeError] = React.useState<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MaplibreMap | null>(null);
  const markerRef = React.useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const isNavigatingAwayRef = React.useRef(false);
  const isDirtyRef = React.useRef(false);

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maxDate = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 3);
    return d;
  }, []);

  const formatDateDisplay = (date?: Date) =>
    date
      ? date.toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Pick a date";

  const pad = (value: number) => String(value).padStart(2, "0");

  const isSameLocalDay = (a?: Date, b?: Date) =>
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getMinTimeForStartDate = () => {
    if (!startDate) return undefined;
    const now = new Date();
    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);
    // If start date is today, return current time, otherwise no minimum
    if (startDate.getTime() === todayAtMidnight.getTime()) {
      return getCurrentTime();
    }
    return undefined;
  };

  const getMinTimeForEndDate = () => {
    if (!endDate || !startDate) return undefined;
    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);
    // If end date is same as start date, minimum end time is start time
    if (endDate.getTime() === startDate.getTime()) {
      return startTime;
    }
    return undefined;
  };

  const areaFromNominatim = (data: any) => {
    const address = data?.address ?? {};
    return (
      address.suburb ||
      address.neighbourhood ||
      address.city_district ||
      address.town ||
      address.city ||
      address.village ||
      address.hamlet ||
      address.county ||
      address.state ||
      null
    );
  };

  const geocodeAbortRef = React.useRef<AbortController | null>(null);
  const geocodeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const lat = formData.location_lat;
    const lng = formData.location_lng;
    if (lat == null || lng == null) {
      setLocationArea(null);
      return;
    }
    if (geocodeTimerRef.current) {
      window.clearTimeout(geocodeTimerRef.current);
    }
    geocodeTimerRef.current = window.setTimeout(async () => {
      try {
        geocodeAbortRef.current?.abort();
        const controller = new AbortController();
        geocodeAbortRef.current = controller;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        const area =
          areaFromNominatim(data) ||
          (typeof data?.display_name === "string"
            ? data.display_name.split(",")[0]?.trim()
            : null);
        setLocationArea(area || null);
      } catch {
        // ignore reverse geocode failures
      }
    }, 400);
    return () => {
      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }
    };
  }, [formData.location_lat, formData.location_lng]);

  const toLocalDateTimeString = (date?: Date, time?: string) => {
    if (!date) return "";
    const [hh = "00", mm = "00"] = (time || "00:00").split(":");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}T${pad(Number(hh))}:${pad(Number(mm))}`;
  };

  const toLocalDateTime = (date?: Date, time?: string) => {
    if (!date) return undefined;
    const [hh = "00", mm = "00"] = (time || "00:00").split(":");
    const next = new Date(date);
    next.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    return next;
  };

  const parseDateTimeString = (
    value: string
  ): { date?: Date; time?: string } => {
    if (!value) return {};
    const date = new Date(value);
    if (isNaN(date.getTime())) return {};
    const time = value.split("T")[1]?.slice(0, 5);
    return { date, time };
  };

  const handleStartDateChange = (date?: Date) => {
    setStartDate(date || undefined);
    const newValue = toLocalDateTimeString(date, startTime);
    updateField("start_time", newValue);
    if (date && endDate && endDate < date) {
      setEndDate(undefined);
      setEndTime("18:00");
      updateField("end_time", "");
    }
  };

  const handleEndDateChange = (date?: Date) => {
    if (noEndTime) return;
    setEndDate(date || undefined);
    // If end date is same as start date but end time is before start time, reset it
    if (
      date &&
      startDate &&
      date.getTime() === startDate.getTime() &&
      endTime < startTime
    ) {
      setEndTime(startTime);
      const newValue = toLocalDateTimeString(date, startTime);
      updateField("end_time", newValue);
    } else {
      const newValue = toLocalDateTimeString(date, endTime);
      updateField("end_time", newValue);
    }
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    const newValue = toLocalDateTimeString(startDate, value);
    updateField("start_time", newValue);
  };

  const handleEndTimeChange = (value: string) => {
    if (noEndTime) return;
    setEndTime(value);
    const newValue = toLocalDateTimeString(endDate, value);
    updateField("end_time", newValue);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setInitialImageSrc(dataUrl);
      setImageEditorOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    if (e.target) e.target.value = "";
  };

  const handleImageEditorCancel = () => {
    setImageEditorOpen(false);
    setInitialImageSrc(null);
  };

  const handleImageEditorSave = async (blob: Blob) => {
    try {
      setUploadingCover(true);
      // Convert blob to data URL for persistent preview
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCoverImagePreview(dataUrl);
      };
      reader.readAsDataURL(blob);

      // Upload to Supabase
      const filePath = `${Date.now()}-group-cover.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("group-media")
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      updateField("cover_image_url", filePath);
      setImageEditorOpen(false);
      setInitialImageSrc(null);
    } catch (error) {
      console.error("Failed to upload cover image", error);
      alert(
        "Failed to upload cover image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setUploadingCover(false);
    }
  };

  // If URL contains an id or step, initialize edit mode and step
  React.useEffect(() => {
    const idParam = searchParams.get("id");
    const stepParam = searchParams.get("step");

    // If no id param exists, clear any stored groupId
    if (!idParam) {
      setGroupId(null);
      // Also clear localStorage if it has a groupId but we're creating a new group
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.groupId) {
            const cleaned = { ...parsed };
            delete cleaned.groupId;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
        }
      } catch (error) {
        console.warn("Failed to clean localStorage", error);
      }
    } else if (idParam !== groupId) {
      setGroupId(idParam);
    }

    if (stepParam) {
      const n = parseInt(stepParam);
      if (!isNaN(n)) {
        const clamped = Math.min(5, Math.max(1, n));
        setStep(clamped);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  React.useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await supabase
          .from("group_categories")
          .select("id, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        setCategories(data || []);
      } catch (error) {
        console.error("Failed to load categories", error);
      } finally {
        setCategoriesLoading(false);
      }
    }
    loadCategories();
  }, [supabase]);

  const loadCohostSuggestions = React.useCallback(async () => {
    try {
      setCohostLoading(true);
      console.log("[Groups Debug] load start");
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id;
      console.log("[Groups Debug] auth user", me);
      if (!me) {
        console.log("[Groups Debug] no auth user");
        setCohostSuggestions([]);
        return;
      }

      let { data: myMemberships, error: membershipError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", me);

      console.log("[Groups Debug] membership raw", myMemberships);

      // Fallback to RPC if direct query returns empty (RLS issue)
      if (!membershipError && (!myMemberships || myMemberships.length === 0)) {
        try {
          const { data: fallbackMemberships, error: fallbackError } =
            await supabase.rpc("get_my_conversation_memberships_secure");
          if (!fallbackError && Array.isArray(fallbackMemberships)) {
            myMemberships = fallbackMemberships;
            console.log("[Groups Debug] used fallback RPC, got", myMemberships?.length);
          } else if (fallbackError) {
            membershipError = fallbackError;
          }
        } catch (err: any) {
          membershipError = err;
        }
      }

      if (membershipError) throw membershipError;

      const convIds = Array.from(
        new Set(
          (myMemberships || []).map((c: any) => c.conversation_id).filter(Boolean)
        )
      );

      let { data: others } = await supabase
        .from("conversation_members")
        .select("user_id")
        .in("conversation_id", convIds)
        .neq("user_id", me);

      // Fallback to RPC if direct query fails (RLS issue)
      if (convIds.length && (!others || others.length === 0)) {
        try {
          const { data: fallbackMembers, error: fallbackError } =
            await supabase.rpc("get_conversation_members_secure", {
              convo_ids: convIds,
            });
          if (!fallbackError && Array.isArray(fallbackMembers)) {
            others = fallbackMembers.filter((m: any) => m.user_id !== me);
            console.log("[Groups Debug] used fallback RPC for members, got", others?.length);
          }
        } catch (err: any) {
          console.warn("[Groups Debug] fallback RPC failed", err);
        }
      }

      const otherIds = Array.from(
        new Set((others || []).map((m: any) => m.user_id))
      ).filter((id) => id && id !== me);
      const suggestions = new Set<string>(
        otherIds.filter((id) => id && id !== me)
      );

      const { data: ownedConnections } = await supabase
        .from("connections")
        .select("id")
        .eq("owner_id", me)
        .in("type", ["contact", "pin"]);

      const connectionIds = (ownedConnections || []).map((conn: any) => conn.id);

      if (connectionIds.length) {
        const { data: contactRows } = await supabase
          .from("connection_contacts")
          .select("profile_id")
          .in("connection_id", connectionIds)
          .not("profile_id", "is", null);
        for (const row of contactRows || []) {
          if (row?.profile_id) suggestions.add(row.profile_id);
        }

        const { data: pinRows } = await supabase
          .from("connection_pins")
          .select("pinned_profile_id")
          .in("connection_id", connectionIds)
          .not("pinned_profile_id", "is", null);
        for (const row of pinRows || []) {
          if (row?.pinned_profile_id) suggestions.add(row.pinned_profile_id);
        }
      }

      const suggestionIds = Array.from(suggestions)
        .filter((id) => id && id !== me)
        .slice(0, 60);
      console.log("[Groups Debug] conversation IDs", convIds);
      console.log("[Groups Debug] connection/contact IDs", suggestionIds);

      console.log("[Groups Debug] conversation IDs", convIds);
      console.log("[Groups Debug] connection/contact IDs", suggestionIds);

      if (!suggestionIds.length) {
        setCohostSuggestions([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, profile_title, avatar_url")
        .in("id", suggestionIds);

      const people: Person[] = (profiles || []).map((p: any) => ({
        id: p.id,
        username: p.username || "user",
        profile_title: p.profile_title || null,
        avatar_url: p.avatar_url || null,
      }));

      console.log("[Groups Debug] filtered suggestions", people.map((p) => p.id));
      setCohostSuggestions(people);
      setCohostProfiles((prev) => {
        const next = { ...prev };
        for (const person of people) {
          next[person.id] = person;
        }
        return next;
      });
    } catch (error) {
      console.error("[Groups Debug] error fetching suggestions", error);
      console.warn("Failed to load co-host suggestions", error);
      setCohostSuggestions([]);
    } finally {
      setCohostLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    console.log("[Groups Debug] effect run");
    loadCohostSuggestions();
  }, [loadCohostSuggestions]);

  React.useEffect(() => {
    const missing = (formData.cohost_ids || []).filter(
      (id) => !cohostProfiles[id]
    );
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, profile_title, avatar_url")
          .in("id", missing);
        if (cancelled || !data) return;
        setCohostProfiles((prev) => {
          const next = { ...prev };
          for (const p of data as any[]) {
            next[p.id] = {
              id: p.id,
              username: p.username || "user",
              profile_title: p.profile_title || null,
              avatar_url: p.avatar_url || null,
            };
          }
          return next;
        });
      } catch (error) {
        console.warn("Failed to hydrate co-host profiles", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.cohost_ids, cohostProfiles, supabase]);

  // Restore saved progress from localStorage and Supabase
  React.useEffect(() => {
    if (hasHydratedRef.current) return;

    const idParam = searchParams.get("id");

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.step && idParam) setStep(parsed.step);
        // Only restore formData if we have an id in the URL params (edit mode)
        if (parsed.formData && idParam) {
          setFormData((prev) => ({
            ...prev,
            ...parsed.formData,
            house_rules: parsed.formData.house_rules?.length
              ? parsed.formData.house_rules
              : [""],
            provided_items: parsed.formData.provided_items?.length
              ? parsed.formData.provided_items
              : [""],
            cohost_ids: parsed.formData.cohost_ids?.length
              ? parsed.formData.cohost_ids
              : [],
          }));
        }
        if (parsed.coverImagePreview && idParam) {
          setCoverImagePreview(parsed.coverImagePreview);
        }
        // Only restore groupId if we have an id in the URL params
        if (parsed.groupId && idParam) {
          setGroupId(parsed.groupId);
        }
      }
    } catch (error) {
      console.warn("Failed to restore saved progress", error);
    } finally {
      hasHydratedRef.current = true;
    }
  }, [searchParams]);

  // If we have a saved groupId, hydrate from Supabase
  React.useEffect(() => {
    const loadDraft = async () => {
      if (!groupId) return;
      try {
        const { data, error } = await supabase
          .from("groups")
          .select(
            "id, title, description, category_id, start_time, end_time, location_text, location_lat, location_lng, postcode, additional_details, display_details_on_day, max_attendees, house_rules, provided_items, is_public, cover_image_url, cohost_ids, status"
          )
          .eq("id", groupId)
          .single();

        if (error || !data) return;

        const row: Record<string, any> = data;
        setFormData((prev) => ({
          ...prev,
          title: data.title || "",
          description: data.description || "",
          category_id: data.category_id || "",
          start_time: data.start_time || "",
          end_time: data.end_time || "",
          location_text: data.location_text || "",
          location_lat:
            typeof (data as any).location_lat === "number"
              ? (data as any).location_lat
              : null,
          location_lng:
            typeof (data as any).location_lng === "number"
              ? (data as any).location_lng
              : null,
          postcode: data.postcode || "",
          additional_details: data.additional_details || "",
          display_details_on_day: (data.additional_details || "").trim()
            ? data.display_details_on_day ?? true
            : false,
          max_attendees: data.max_attendees ? String(data.max_attendees) : "",
          house_rules: data.house_rules?.length ? data.house_rules : [""],
          provided_items: data.provided_items?.length
            ? data.provided_items
            : [""],
          is_public: data.is_public ?? true,
          cover_image_url: data.cover_image_url || null,
          cohost_ids: Array.isArray(data.cohost_ids) ? data.cohost_ids : [],
          show_on_map: row.show_on_map ?? true,
        }));
        setPublishedStatus(data.status === "published");

        const coverUrl = resolveCoverUrl(data.cover_image_url);
        if (coverUrl) setCoverImagePreview(coverUrl);
      } catch (error) {
        console.warn("Failed to hydrate draft from Supabase", error);
      }
    };

    loadDraft();
  }, [groupId, supabase]);

  // Sync date/time pickers from formData (for hydration or external changes)
  React.useEffect(() => {
    const { date, time } = parseDateTimeString(formData.start_time);
    if (date) setStartDate(date);
    if (time) setStartTime(time);

    const end = parseDateTimeString(formData.end_time);
    if (end.date) setEndDate(end.date);
    if (end.time) setEndTime(end.time);
    if (!formData.end_time) setNoEndTime(true);
  }, [formData.start_time, formData.end_time]);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formData.title || formData.description || formData.category_id) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formData]);

  React.useEffect(() => {
    isDirtyRef.current = Boolean(
      formData.title || formData.description || formData.category_id
    );
  }, [formData.title, formData.description, formData.category_id]);

  // Intercept browser back/forward navigation
  React.useEffect(() => {
    const handlePopState = () => {
      if (isNavigatingAwayRef.current) {
        // Allow navigation - don't reset the ref or push state
        return;
      }

      if (isDirtyRef.current) {
        // Prevent navigation by pushing current state back
        window.history.pushState(null, "", window.location.href);

        // Show dialog
        setPendingNavigation(() => () => {
          isNavigatingAwayRef.current = true;
          window.history.back();
        });
        setShowLeaveDialog(true);
      }
    };

    // Push initial state
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Reset ref on unmount
      isNavigatingAwayRef.current = false;
    };
  }, []);

  // Persist progress to localStorage when state changes (after hydration)
  React.useEffect(() => {
    if (!hasHydratedRef.current) return;
    const snapshot = {
      step,
      formData,
      coverImagePreview,
      groupId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Failed to persist progress", error);
    }
  }, [step, formData, coverImagePreview, groupId]);

  React.useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || step !== 2) return;

    let canceled = false;

    const initMap = async () => {
      try {
        let style: string | StyleSpecification;
        try {
          const res = await fetch("/maps/proximity-dark.json");
          if (res.ok) {
            style = (await res.json()) as StyleSpecification;
          } else {
            style = "https://tiles.openfreemap.org/styles/positron";
          }
        } catch {
          style = "https://tiles.openfreemap.org/styles/positron";
        }

        if (canceled || !mapContainerRef.current) return;

          const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style,
            center: [-0.1276, 51.5072],
            zoom: 15,
            pitch: 35,
            // @ts-expect-error antialias is supported
            antialias: true,
            attributionControl: false,
            minZoom: 15,
            maxZoom: 15,
          });

        map.on("load", () => {
          if (canceled) return;

          // Hide road numbers
          const layers = map.getStyle().layers;
          if (layers) {
            layers.forEach((layer) => {
              if (layer.type !== "symbol" || !layer.layout) return;
              const textField = layer.layout["text-field"] as unknown;
              const hasRefToken = (field: unknown) => {
                if (typeof field === "string") return field.includes("{ref}");
                if (Array.isArray(field))
                  return JSON.stringify(field).includes('"ref"');
                return false;
              };
              if (hasRefToken(textField)) {
                map.setLayoutProperty(layer.id, "visibility", "none");
              }
            });
          }

          // Add building extrusions
          const BUILDING_SOURCE_ID = "openfreemap-buildings";
          if (!map.getSource(BUILDING_SOURCE_ID)) {
            const labelLayerId = map
              .getStyle()
              .layers?.find(
                (layer) =>
                  layer.type === "symbol" &&
                  (layer.layout as { "text-field"?: unknown })?.["text-field"]
              )?.id;

            map.addSource(BUILDING_SOURCE_ID, {
              url: "https://tiles.openfreemap.org/planet",
              type: "vector",
            });

            map.addLayer(
              {
                id: "3d-buildings",
                source: BUILDING_SOURCE_ID,
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 15,
                filter: ["!=", ["get", "hide_3d"], true],
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0,
                    "#0f1113",
                    120,
                    "#13171b",
                    300,
                    "#161b20",
                  ],
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15,
                    0,
                    16,
                    ["get", "render_height"],
                  ],
                  "fill-extrusion-base": [
                    "step",
                    ["zoom"],
                    0,
                    16,
                    ["coalesce", ["get", "render_min_height"], 0],
                  ],
                  "fill-extrusion-opacity": 0.4,
                },
              },
              labelLayerId
            );
          }

          // Create fixed center pin
          const pinContainer = document.createElement("div");
          pinContainer.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 32px;
            height: 32px;
            margin-left: -16px;
            margin-top: -32px;
            z-index: 10;
            pointer-events: none;
          `;

          const pinSVG = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          pinSVG.setAttribute("viewBox", "0 0 24 24");
          pinSVG.setAttribute("width", "32");
          pinSVG.setAttribute("height", "32");
          pinSVG.style.cssText = `
            filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
            color: hsl(var(--primary));
            transition: all 0.2s ease-out;
          `;
          pinSVG.innerHTML =
            '<path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';

          pinContainer.appendChild(pinSVG);
          mapContainerRef.current?.appendChild(pinContainer);
          markerRef.current = pinContainer as any;

          // Update location when map moves
          const updateLocation = () => {
            if (!map) return;
            const center = map.getCenter();
            const lat = Number(center.lat.toFixed(6));
            const lng = Number(center.lng.toFixed(6));
            updateField("location_lat", lat);
            updateField("location_lng", lng);
          };

          map.on("move", updateLocation);
          map.on("zoom", updateLocation);

          // Pin animation on drag
          map.on("dragstart", () => {
            pinSVG.style.transform = "scale(1.15) translateY(-4px)";
          });
          map.on("dragend", () => {
            pinSVG.style.transform = "scale(1) translateY(0)";
          });

          setMapReady(true);

          // Set initial location
          const initialCenter = map.getCenter();
          updateField("location_lat", Number(initialCenter.lat.toFixed(6)));
          updateField("location_lng", Number(initialCenter.lng.toFixed(6)));
        });

        mapRef.current = map;

        // Default to current user location if available
        if (navigator?.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!mapRef.current) return;
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              mapRef.current.setCenter([lng, lat]);
              updateField("location_lat", Number(lat.toFixed(6)));
              updateField("location_lng", Number(lng.toFixed(6)));
            },
            () => {
              // keep default center
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        }
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    initMap();

    return () => {
      canceled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
      }
      if (markerRef.current && (markerRef.current as any).parentElement) {
        (markerRef.current as any).parentElement.removeChild(markerRef.current);
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [step]);

  const handleNavigation = (callback: () => void) => {
    if (formData.title || formData.description || formData.category_id) {
      setPendingNavigation(() => callback);
      setShowLeaveDialog(true);
    } else {
      callback();
    }
  };

  const handleDiscardAndLeave = () => {
    setShowLeaveDialog(false);

    // If creating a new group (no groupId) and user chooses to discard, clear localStorage
    if (!groupId) {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Execute the pending navigation immediately
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleSaveAsDraft = async () => {
    setShowLeaveDialog(false);
    try {
      await saveDraft();
      localStorage.removeItem(STORAGE_KEY);

      // Execute the pending navigation after saving
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    } catch (error) {
      console.error("Failed to save draft", error);
    }
  };

  const handleContinueEditing = () => {
    setShowLeaveDialog(false);
    setPendingNavigation(null);
  };

  const handleNextStep = async (nextStep: number) => {
    await saveDraft();
    setStep(nextStep);
    const idParam = searchParams.get("id") || groupId;
    if (idParam) {
      router.replace(`/app/activity/groups/create?id=${idParam}&step=${nextStep}`);
    }
  };

  const updateField = (field: keyof GroupFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  React.useEffect(() => {
    if (!formData.additional_details.trim() && formData.display_details_on_day) {
      setFormData((prev) => ({ ...prev, display_details_on_day: false }));
    }
  }, [formData.additional_details, formData.display_details_on_day]);

  const updateArrayField = (
    field: "house_rules" | "provided_items",
    index: number,
    value: string
  ) => {
    setFormData((prev) => {
      const updated = [...prev[field]];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  };

  const addArrayField = (field: "house_rules" | "provided_items") => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const removeArrayField = (
    field: "house_rules" | "provided_items",
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const addCohost = (person: Person) => {
    setFormData((prev) => {
      const existing = new Set(prev.cohost_ids || []);
      if (existing.has(person.id) || existing.size >= 3) return prev;
      const next = [...existing, person.id];
      return { ...prev, cohost_ids: Array.from(next) };
    });
    setCohostProfiles((prev) => ({ ...prev, [person.id]: person }));
  };

  const removeCohost = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      cohost_ids: (prev.cohost_ids || []).filter((cid) => cid !== id),
    }));
  };

  const saveDraft = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in");
      }

        const draftData = {
        host_id: user.id,
        title: formData.title,
        description: formData.description || null,
        category_id: formData.category_id || null,
        cover_image_url: formData.cover_image_url || null,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        postcode: formData.postcode || null,
        additional_details: formData.additional_details || null,
        display_details_on_day: formData.display_details_on_day,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        house_rules: formData.house_rules.filter((r) => r.trim().length > 0),
        provided_items: formData.provided_items.filter((p) => p.trim().length > 0),
        is_public: formData.is_public,
        show_on_map: formData.show_on_map,
        status: "draft",
        cohost_ids: formData.cohost_ids || [],
      };

      if (groupId) {
        // Update existing draft
        const { error } = await supabase
          .from("groups")
          .update(draftData)
          .eq("id", groupId);

        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("groups")
          .insert([draftData])
          .select("id")
          .single();

        if (error) throw error;
        if (data?.id) {
          setGroupId(data.id);
          // Update URL to include the new group ID so the URL param effect doesn't clear it
          router.replace(`/app/activity/groups/create?id=${data.id}&step=${step}`);
        }
      }
    } catch (error) {
      console.error("Failed to save draft", error);
    }
  };

  const handleSubmit = async (publish = publishedStatus) => {
    // Prevent duplicate submissions
    if (loading) return;

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in");
      }

      const targetStatus = publish ? "published" : "draft";
      const groupData = {
        host_id: user.id,
        title: formData.title,
        description: formData.description || null,
        category_id: formData.category_id || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location_text:
          formData.location_text && !isLatLngText(formData.location_text)
            ? formData.location_text
            : null,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        postcode: formData.postcode || null,
        additional_details: formData.additional_details || null,
        display_details_on_day: formData.display_details_on_day,
        max_attendees: formData.max_attendees
          ? parseInt(formData.max_attendees)
          : null,
        house_rules: formData.house_rules.filter((r) => r.trim().length > 0),
        provided_items: formData.provided_items.filter(
          (p) => p.trim().length > 0
        ),
        is_public: formData.is_public,
        show_on_map: formData.show_on_map,
        cover_image_url: formData.cover_image_url || null,
        status: targetStatus,
        cohost_ids: Array.isArray(formData.cohost_ids)
          ? formData.cohost_ids.slice(0, 3)
          : [],
      };

      // If a draft group already exists (from saveDraft), update it.
      // Otherwise, insert a new group.
      let createdOrUpdatedId: string | null = groupId;
      if (groupId) {
        const { error } = await supabase
          .from("groups")
          .update(groupData)
          .eq("id", groupId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("groups")
          .insert([groupData])
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          createdOrUpdatedId = data.id;
          setGroupId(data.id);
        }
      }

      // Clear localStorage after successful creation
      localStorage.removeItem(STORAGE_KEY);

      const destinationTab = publish ? "Published" : "Drafts";
      router.push(`/app/activity/groups/manage?tab=${destinationTab}`);
    } catch (error) {
      console.error("Failed to create group", error);
      alert(
        "Failed to create group: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const validateStep2 = () => {
    // Validate start time
    if (!formData.start_time || !startDate) return { valid: false };

    // Check if start time is in the past (when date is today)
    const now = new Date();
    const isEditing = Boolean(groupId || searchParams.get("id"));
    const startAt = toLocalDateTime(startDate, startTime);
    const endLimit = noEndTime
      ? (() => {
          if (!startDate) return undefined;
          const midnight = new Date(startDate);
          midnight.setHours(24, 0, 0, 0);
          return midnight;
        })()
      : toLocalDateTime(endDate, endTime);
    const isInProgress =
      !!startAt && !!endLimit && now >= startAt && now < endLimit;
    if (isSameLocalDay(startDate, now)) {
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      if (startTime < currentTime) {
        if (isEditing && isInProgress) {
          return { valid: true };
        }
        return {
          valid: false,
          startTimeError: "Event start cannot be in the past",
        };
      }
    }

    // If no end time, we're good
    if (noEndTime) return { valid: true };

    // Validate end time
    if (!formData.end_time || !endDate) return { valid: false };

    // Check if end date is before start date
    if (endDate < startDate) {
      return {
        valid: false,
        endTimeError: "End of session cannot be before it starts",
      };
    }

    // Check if end time is before start time (when same day)
    if (isSameLocalDay(endDate, startDate) && endTime < startTime) {
      return {
        valid: false,
        endTimeError: "End of session cannot be before it starts",
      };
    }

    return { valid: true };
  };

  // Validate step 2 when relevant state changes
  React.useEffect(() => {
    if (step !== 2) return;
    const validation = validateStep2();
    setStartTimeError(validation.startTimeError || null);
    setEndTimeError(validation.endTimeError || null);
  }, [
    startDate,
    startTime,
    endDate,
    endTime,
    noEndTime,
    formData.start_time,
    formData.end_time,
    step,
  ]);

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.title.trim().length >= 3 && formData.category_id;
      case 2: {
        const validation = validateStep2();
        return validation.valid;
      }
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 pb-[calc(72px+env(safe-area-inset-bottom))] overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {groupId || searchParams.get("id") ? "Edit group" : "Create group"}
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="mb-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition-all ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-3 min-h-96">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Group basics</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleNextStep(step + 1)}
                  disabled={!canProceed()}
                  className="rounded-full"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input
                    placeholder="Give your group a name"
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    maxLength={120}
                    className="peer pr-14"
                  />
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3 text-xs tabular-nums peer-disabled:opacity-50">
                    {formData.title.length}/120
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>Type of group</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => updateField("category_id", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        categoriesLoading ? "Loading..." : "Select a category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Group type</SelectLabel>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>Description</Label>
                <InputGroup>
                  <InputGroupTextarea
                    placeholder="Describe your group"
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    maxLength={5000}
                    className="min-h-[120px]"
                  />
                  <InputGroupAddon align="block-end">
                    <InputGroupText className="text-[10px]">
                      {5000 - formData.description.length} left
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>Cover image</Label>
                <div className="flex flex-col gap-3">
                  {coverImagePreview && (
                    <div
                      className="relative w-full aspect-14/9 overflow-hidden rounded-md bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setImageEditorOpen(true)}
                    >
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoverImagePreview(null);
                          updateField("cover_image_url", null);
                        }}
                        className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm shadow-md hover:bg-black/90 transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (coverImagePreview) {
                        setInitialImageSrc(coverImagePreview);
                        setImageEditorOpen(true);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    {coverImagePreview
                      ? "Edit Cover Image"
                      : "Choose Cover Image"}
                  </Button>
                </div>
              </div>

              {/* Image Editor Modal */}
              {imageEditorOpen && (
                <ImageEditor
                  onSave={handleImageEditorSave}
                  onCancel={handleImageEditorCancel}
                  title="Position your cover image"
                  shape="rectangle"
                  aspectRatio={14 / 9}
                  initialImageSrc={initialImageSrc || undefined}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-lg"
                onClick={() => handleNextStep(step + 1)}
                disabled={!canProceed()}
              >
                Save and continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-lg"
                onClick={async () => {
                  await saveDraft();
                  router.push("/app/activity/groups/manage?tab=Drafts");
                }}
              >
                Save and exit
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">When & where</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-9 h-9"
                  onClick={async () => {
                    await saveDraft();
                    const prevStep = step - 1;
                    setStep(prevStep);
                    const idParam = searchParams.get("id") || groupId;
                    if (idParam) {
                      router.replace(`/app/activity/groups/create?id=${idParam}&step=${prevStep}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleNextStep(step + 1)}
                  disabled={!canProceed()}
                  className="rounded-full"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <Label className="px-1">Start</Label>
                <div className="flex flex-row items-center gap-4">
                  <div className="flex flex-1">
                    <Popover
                      open={openStartDate}
                      onOpenChange={setOpenStartDate}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between font-normal"
                          id="start-date"
                        >
                          {formatDateDisplay(startDate)}
                          <ChevronDownIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            handleStartDateChange(date || undefined);
                            setOpenStartDate(false);
                          }}
                          disabled={[{ before: today }, { after: maxDate }]}
                          fromMonth={today}
                          toMonth={maxDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-32 shrink-0">
                    <Input
                      id="start-time"
                      type="time"
                      step="60"
                      min={getMinTimeForStartDate()}
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className={`bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none ${
                        startTimeError ? "border-destructive" : ""
                      }`}
                    />
                  </div>
                </div>
                {startTimeError && (
                  <p className="text-xs text-destructive px-1">
                    {startTimeError}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <Label className="px-1">End</Label>
                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="no-end-time" className="cursor-pointer">
                    No fixed end time
                  </Label>
                  <Switch
                    id="no-end-time"
                    checked={noEndTime}
                    onCheckedChange={(checked) => {
                      setNoEndTime(checked);
                      if (checked) {
                        setEndDate(undefined);
                        setEndTime("18:00");
                        updateField("end_time", "");
                      }
                    }}
                  />
                </div>
                <div className="flex flex-row items-center gap-4">
                  <div className="flex flex-1">
                    <Popover open={openEndDate} onOpenChange={setOpenEndDate}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between font-normal"
                          id="end-date"
                          disabled={noEndTime}
                        >
                          {noEndTime
                            ? "No end time"
                            : formatDateDisplay(endDate)}
                          <ChevronDownIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            handleEndDateChange(date || undefined);
                            setOpenEndDate(false);
                          }}
                          disabled={
                            startDate
                              ? [
                                  { before: startDate },
                                  { before: today },
                                  { after: maxDate },
                                ]
                              : [{ before: today }, { after: maxDate }]
                          }
                          fromMonth={today}
                          toMonth={maxDate}
                          captionLayout="dropdown"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-32 shrink-0">
                    <Input
                      id="end-time"
                      type="time"
                      step="60"
                      min={getMinTimeForEndDate()}
                      value={endTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className={`bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none ${
                        endTimeError ? "border-destructive" : ""
                      }`}
                      disabled={noEndTime}
                    />
                  </div>
                </div>
                {endTimeError && (
                  <p className="text-xs text-destructive px-1">
                    {endTimeError}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Location</Label>
                  <span className="text-xs text-muted-foreground">
                    Drag map to choose
                  </span>
                </div>
                <div
                  ref={mapContainerRef}
                  className="h-64 w-full overflow-hidden rounded-md bg-muted touch-none transition-opacity duration-500"
                  style={{
                    opacity: mapReady ? 1 : 0,
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.location_lat != null &&
                  formData.location_lng != null
                    ? `Pinned: ${
                        locationArea ||
                        `${formData.location_lat.toFixed(
                          6
                        )}, ${formData.location_lng.toFixed(6)}`
                      }`
                    : "Drag the map to position the pin where you're meeting."}
                </p>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>
                  Description{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  placeholder="e.g. St Giles Hotel"
                  value={formData.location_text}
                  onChange={(e) => updateField("location_text", e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <Label>
                  Postcode{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  placeholder="e.g., SW1A 1AA"
                  value={formData.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <Label>
                  Additional details{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <InputGroup>
                  <InputGroupTextarea
                    placeholder="e.g. Door open, flat 34b"
                    value={formData.additional_details}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      updateField("additional_details", nextValue);
                      if (!nextValue.trim()) {
                        updateField("display_details_on_day", false);
                      }
                    }}
                    maxLength={1000}
                    className="min-h-[120px]"
                  />
                  <InputGroupAddon align="block-end">
                    <InputGroupText className="text-[10px]">
                      Hidden from the listing
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="display-details-on-day"
                    checked={formData.display_details_on_day}
                    onCheckedChange={(checked) =>
                      updateField("display_details_on_day", checked)
                    }
                  />
                  <Label
                    htmlFor="display-details-on-day"
                    className="cursor-pointer"
                  >
                    Display to attendees on the day
                  </Label>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-lg"
                onClick={() => handleNextStep(step + 1)}
                disabled={!canProceed()}
              >
                Save and continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-lg"
                onClick={async () => {
                  await saveDraft();
                  router.push("/app/activity/groups/manage?tab=Drafts");
                }}
              >
                Save and exit
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">The event</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-9 h-9"
                  onClick={async () => {
                    await saveDraft();
                    const prevStep = step - 1;
                    setStep(prevStep);
                    const idParam = searchParams.get("id") || groupId;
                    if (idParam) {
                      router.replace(`/app/activity/groups/create?id=${idParam}&step=${prevStep}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleNextStep(step + 1)}
                  className="rounded-full"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <div className="space-y-1">
                  <Label>Co-hosts</Label>
                  <p className="text-sm text-muted-foreground">
                    Invite up to 3 co-hosts to help manage the group.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedCohosts.length ? (
                    selectedCohosts.map((person) => {
                      const avatarUrl = getAvatarProxyUrl(person.avatar_url) ?? undefined;
                      const displayName = person.profile_title?.trim() || person.username || "Unknown";
                      const truncatedName = truncatedLabel(displayName, 16);
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => removeCohost(person.id)}
                          className="group inline-flex items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition hover:border-destructive/60 hover:text-destructive"
                        >
                          <Avatar className="h-7 w-7">
                            {avatarUrl ? (
                              <AvatarImage src={avatarUrl} alt={displayName} />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {initialsFrom(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{truncatedName}</span>
                          <X className="h-3 w-3 text-muted-foreground transition group-hover:text-destructive" />
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No co-hosts selected yet.
                    </p>
                  )}
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Suggestions
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      From your conversations
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto px-4 pb-2 -mx-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {cohostLoading ? (
                      <>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={`skeleton-${i}`}
                            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5"
                          >
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        ))}
                      </>
                    ) : filteredCohostSuggestions.length ? (
                      filteredCohostSuggestions.map((person) => {
                        const avatarUrl = getAvatarProxyUrl(person.avatar_url) ?? undefined;
                        const displayName = person.profile_title?.trim() || person.username || "Unknown";
                        const truncatedName = truncatedLabel(displayName, 16);
                        const disabled =
                          (formData.cohost_ids || []).includes(person.id) ||
                          (formData.cohost_ids || []).length >= 3;
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => addCohost(person)}
                            disabled={disabled}
                            className={`shrink-0 inline-flex items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm transition ${
                              disabled
                                ? "opacity-60 cursor-not-allowed"
                                : "hover:bg-muted"
                            }`}
                          >
                            <Avatar className="h-7 w-7">
                              {avatarUrl ? (
                                <AvatarImage src={avatarUrl} alt={displayName} />
                              ) : null}
                              <AvatarFallback className="text-[10px]">
                                {initialsFrom(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{truncatedName}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="shrink-0 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        No suggestions available.
                      </div>
                    )}
                    <div className="w-0 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max attendees</Label>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = parseInt(formData.max_attendees) || 0;
                        const next = Math.max(0, current - 1);
                        updateField(
                          "max_attendees",
                          next === 0 ? "" : String(next)
                        );
                      }}
                      className="h-8 w-8 p-0 rounded-l-full rounded-r-none border-r-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div
                      className={`h-8 px-3 flex items-center justify-center min-w-12 border-y border-input text-sm ${
                        !formData.max_attendees ||
                        parseInt(formData.max_attendees) === 0
                          ? "text-muted-foreground"
                          : "font-semibold"
                      }`}
                    >
                      {formData.max_attendees &&
                      parseInt(formData.max_attendees) > 0 ? (
                        formData.max_attendees
                      ) : (
                        <Infinity className="h-4 w-4" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = parseInt(formData.max_attendees) || 0;
                        const next = current + 1;
                        updateField("max_attendees", String(next));
                      }}
                      className="h-8 w-8 p-0 rounded-r-full rounded-l-none border-l-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!formData.max_attendees ||
                  parseInt(formData.max_attendees) === 0
                    ? "An unlimited number of people can be invited."
                    : `A maximum of ${formData.max_attendees} people can be invited, not including hosts.`}
                </p>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <Label>Available items</Label>
                <div className="space-y-2">
                  {formData.provided_items.map((item, idx) => (
                    <div key={idx} className="relative">
                      <Input
                        placeholder="e.g., Drinks, Food"
                        value={item}
                        onChange={(e) =>
                          updateArrayField(
                            "provided_items",
                            idx,
                            e.target.value
                          )
                        }
                        className="pr-9"
                      />
                      {item && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeArrayField("provided_items", idx)
                          }
                          className="text-destructive hover:text-destructive focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:bg-transparent"
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="sr-only">Remove item</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayField("provided_items")}
                  className="h-8 text-xs"
                >
                  Add Item
                </Button>
                <div className="border-t border-border/50 pt-3">
                  <Label className="text-xs text-muted-foreground">
                    Suggestions
                  </Label>
                  <div className="flex gap-2 overflow-x-auto px-4 pb-2 -mx-4 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {[
                      "Poppers",
                      "Lube",
                      "Towels",
                      "Beers",
                      "Playroom",
                      "Toys",
                    ]
                      .filter(
                        (suggestion) =>
                          !formData.provided_items.some(
                            (item) =>
                              item.trim().toLowerCase() ===
                              suggestion.toLowerCase()
                          )
                      )
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            // Find first empty slot or add new one
                            const emptyIndex = formData.provided_items.findIndex(
                              (item) => !item.trim()
                            );
                            if (emptyIndex !== -1) {
                              updateArrayField(
                                "provided_items",
                                emptyIndex,
                                suggestion
                              );
                            } else {
                              updateField("provided_items", [
                                ...formData.provided_items,
                                suggestion,
                              ]);
                            }
                          }}
                          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border border-input bg-background hover:bg-muted transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    <div className="w-0 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-lg"
                onClick={() => handleNextStep(step + 1)}
              >
                Save and continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-lg"
                onClick={async () => {
                  await saveDraft();
                  router.push("/app/activity/groups/manage?tab=Drafts");
                }}
              >
                Save and exit
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: House Rules */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">House rules</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-9 h-9"
                  onClick={async () => {
                    await saveDraft();
                    const prevStep = step - 1;
                    setStep(prevStep);
                    const idParam = searchParams.get("id") || groupId;
                    if (idParam) {
                      router.replace(`/app/activity/groups/create?id=${idParam}&step=${prevStep}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleNextStep(step + 1)}
                  className="rounded-full"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                <Label>House rules</Label>
                <div className="space-y-2">
                  {formData.house_rules.map((rule, idx) => (
                    <div key={idx} className="relative">
                      <Input
                        placeholder="e.g., No smoking, Respect others"
                        value={rule}
                        onChange={(e) =>
                          updateArrayField("house_rules", idx, e.target.value)
                        }
                        className="pr-9"
                      />
                      {rule && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArrayField("house_rules", idx)}
                          className="text-destructive hover:text-destructive focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:bg-transparent"
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="sr-only">Remove rule</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayField("house_rules")}
                  className="h-8 text-xs"
                >
                  Add Rule
                </Button>
                <div className="border-t border-border/50 pt-3">
                  <Label className="text-xs text-muted-foreground">
                    Suggestions
                  </Label>
                  <div className="flex gap-2 overflow-x-auto px-4 pb-2 -mx-4 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {[
                      "No smoking",
                      "Respect others",
                      "Clean up after yourself",
                      "No photos",
                      "Safe words required",
                      "Consent is key",
                    ]
                      .filter(
                        (suggestion) =>
                          !formData.house_rules.some(
                            (item) =>
                              item.trim().toLowerCase() ===
                              suggestion.toLowerCase()
                          )
                      )
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            // Find first empty slot or add new one
                            const emptyIndex = formData.house_rules.findIndex(
                              (item) => !item.trim()
                            );
                            if (emptyIndex !== -1) {
                              updateArrayField(
                                "house_rules",
                                emptyIndex,
                                suggestion
                              );
                            } else {
                              updateField("house_rules", [
                                ...formData.house_rules,
                                suggestion,
                              ]);
                            }
                          }}
                          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border border-input bg-background hover:bg-muted transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    <div className="w-0 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-lg"
                onClick={() => handleNextStep(step + 1)}
              >
                Save and continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-lg"
                onClick={async () => {
                  await saveDraft();
                  router.push("/app/activity/groups/manage?tab=Drafts");
                }}
              >
                Save and exit
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Visibility */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Visibility</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-9 h-9"
                  onClick={() => {
                    const prevStep = step - 1;
                    setStep(prevStep);
                    const idParam = searchParams.get("id") || groupId;
                    if (idParam) {
                      router.replace(`/app/activity/groups/create?id=${idParam}&step=${prevStep}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSubmit(publishedStatus)}
                  disabled={loading}
                  className="rounded-full"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {groupId ? "Save" : "Create"}
                      <Check className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Make public</p>
                  <p className="text-sm text-muted-foreground">
                    Allow others to discover this group
                  </p>
                </div>
                <Switch
                  checked={formData.is_public}
                  onCheckedChange={(checked) =>
                    updateField("is_public", checked)
                  }
                />
              </div>
            </div>

            <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Show on map</p>
                  <p className="text-xs text-muted-foreground">
                    Display pin on the main map
                  </p>
                </div>
                <Switch
                  checked={formData.show_on_map}
                  onCheckedChange={(checked) =>
                    updateField("show_on_map", checked)
                  }
                />
              </div>
            </div>

            <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Published status</p>
                  <p className="text-sm text-muted-foreground">
                    Publish this group right after saving
                  </p>
                </div>
                <Switch
                  checked={publishedStatus}
                  onCheckedChange={(checked) => setPublishedStatus(checked)}
                />
              </div>
              {!publishedStatus && (
                <p className="text-xs text-muted-foreground">
                  Your group will be saved as a draft. You can edit details and
                  publish when ready.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-lg"
                onClick={() => handleSubmit(publishedStatus)}
                disabled={loading}
              >
                {groupId
                  ? publishedStatus
                    ? "Edit and publish right away"
                    : "Edit and save draft"
                  : publishedStatus
                  ? "Create and publish"
                  : "Create and save as draft"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Leave Confirmation Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {groupId ? "Discard Changes?" : "Save Your Group?"}
            </DialogTitle>
            <DialogDescription>
              {groupId
                ? "You have unsaved changes. Are you sure you want to leave without saving?"
                : "Would you like to save this group as a draft or discard it?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleContinueEditing}>
              Continue Editing
            </Button>
            {groupId ? (
              <Button onClick={handleDiscardAndLeave}>Discard Changes</Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={handleDiscardAndLeave}
                >
                  Delete
                </Button>
                <Button onClick={handleSaveAsDraft}>
                  Save as Draft
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
