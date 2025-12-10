"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Clock, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Slider } from "@/components/ui/slider";

type MapFilteringProps = {
  className?: string;
  defaultFilterBadges?: string[];
  defaultWhenOption?: string;
  onFilterBadgesChange?: (badges: string[]) => void;
  onWhenOptionChange?: (value: string) => void;
};

const DEFAULT_FILTER_BADGES = [
  // intentionally empty; badges derive from selected filters
];

const WHEN_OPTIONS = [
  "Right now",
  "Later today",
  "This week",
  "Future meet",
  "Checking messages",
];

type FilterSection = {
  key: string;
  label: string;
  options: string[];
};

const STAT_FILTER_SECTIONS: FilterSection[] = [
  {
    key: "sexuality",
    label: "Sexuality",
    options: ["Gay", "Bi", "Straight", "Queer", "Pan"],
  },
  {
    key: "position",
    label: "Position",
    options: ["Top", "Top/Vers", "Vers", "Vers/Bottom", "Bottom"],
  },
  {
    key: "attitude",
    label: "Role",
    options: ["Dom", "Sub", "Switch", "Open"],
  },
  {
    key: "bodyType",
    label: "Body type",
    options: ["Slim", "Average", "Athletic", "Muscular", "Large"],
  },
  {
    key: "ethnicity",
    label: "Ethnicity",
    options: [
      "Asian",
      "Black",
      "Latino",
      "Middle Eastern",
      "Mixed",
      "White",
      "Other",
    ],
  },
  {
    key: "dickSize",
    label: "Dick size",
    options: ["XS", "Small", "Average", "Large", "XL", "XXL"],
  },
  {
    key: "dickCut",
  label: "Cut",
  options: ["Cut", "Uncut"],
  },
];

const buildInitialFilterState = (badges: string[]) => {
  const selected: Record<string, string[]> = {};
  const enabled: Record<string, boolean> = {};
  STAT_FILTER_SECTIONS.forEach((section) => {
    enabled[section.key] = false;
  });
  for (const badge of badges) {
    const match = STAT_FILTER_SECTIONS.find((section) =>
      section.options.includes(badge)
    );
    if (match) {
      selected[match.key] = [...(selected[match.key] ?? []), badge];
      enabled[match.key] = true;
    }
  }
  return { selected, enabled };
};

export default function MapFiltering({
  className,
  defaultFilterBadges = DEFAULT_FILTER_BADGES,
  defaultWhenOption = WHEN_OPTIONS[0],
  onFilterBadgesChange,
  onWhenOptionChange,
}: MapFilteringProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [whenOption, setWhenOption] = useState(defaultWhenOption);
  const initialFilters = useMemo(
    () => buildInitialFilterState(defaultFilterBadges),
    [defaultFilterBadges]
  );
  const [sexualityOptions, setSexualityOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "sexuality")?.options ?? []
  );
  const [positionOptions, setPositionOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "position")?.options ?? []
  );
  const [roleOptions, setRoleOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "attitude")?.options ?? []
  );
  const [bodyTypeOptions, setBodyTypeOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "bodyType")?.options ?? []
  );
  const [ethnicityOptions, setEthnicityOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "ethnicity")?.options ?? []
  );
  const [dickSizeOptions, setDickSizeOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "dickSize")?.options ?? []
  );
  const [dickCutOptions, setDickCutOptions] = useState<string[]>(
    STAT_FILTER_SECTIONS.find((s) => s.key === "dickCut")?.options ?? []
  );
  const [dickSizeValue, setDickSizeValue] = useState<[number, number]>([5, 9]);
  const [dickSizeTouched, setDickSizeTouched] = useState(false);
  const [activeNow, setActiveNow] = useState(false);
  const [hosting, setHosting] = useState(false);
  const [hostingOptions, setHostingOptions] = useState<string[]>([]);
  const [hostingSelected, setHostingSelected] = useState<string[]>([]);
  const [visiting, setVisiting] = useState(false);
  const [horizontalFades, setHorizontalFades] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({});
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >(() => initialFilters.selected);
  const [sectionEnabled, setSectionEnabled] = useState<Record<string, boolean>>(
    () => initialFilters.enabled
  );
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const horizontalRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filterBadges = useMemo(() => {
    const badges: {
      id: string;
      label: string;
      value: string;
      sectionKey: string;
    }[] = [];

    if (activeNow) {
      badges.push({
        id: "active-now",
        label: "Active now",
        value: "Active now",
        sectionKey: "activeNow",
      });
    }
    if (hosting && hostingSelected.length > 0) {
      const label =
        hostingSelected.length > 0 ? hostingSelected.join(", ") : "Hosting";
      badges.push({
        id: "hosting",
        label,
        value: label,
        sectionKey: "hosting",
      });
    }
    if (visiting) {
      badges.push({
        id: "visiting",
        label: "Visiting",
        value: "Visiting",
        sectionKey: "visiting",
      });
    }

    STAT_FILTER_SECTIONS.forEach((section) => {
      if (section.key === "dickSize") {
        if (sectionEnabled[section.key] !== false || dickSizeTouched) {
          const label = `${dickSizeValue[0]}-${dickSizeValue[1]} inches`;
          badges.push({
            id: "dickSize-range",
            label,
            value: label,
            sectionKey: "dickSize",
          });
        }
        return;
      }
      const selected = (selectedFilters[section.key] ?? []).filter(Boolean);
      if (
        sectionEnabled[section.key] === false ||
        !selected ||
        selected.length === 0
      ) {
        return;
      }
      badges.push({
        id: section.key,
        label: selected.join(", "),
        value: selected.join(", "),
        sectionKey: section.key,
      });
    });
    return badges;
  }, [activeNow, sectionEnabled, selectedFilters, dickSizeTouched, dickSizeValue, hosting, hostingSelected]);

  useEffect(() => {
    onFilterBadgesChange?.(filterBadges.map((badge) => badge.label));
  }, [filterBadges, onFilterBadgesChange]);

  useEffect(() => {
    onWhenOptionChange?.(whenOption);
  }, [onWhenOptionChange, whenOption]);

  useEffect(() => {
    // No-op: vertical fade disabled for now
    setShowTopFade(false);
    setShowBottomFade(false);
  }, [showFilters, filterBadges.length, selectedFilters]);

  const updateHorizontalFade = (key: string) => {
    const el = horizontalRefs.current[key];
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canScroll = scrollWidth > clientWidth + 1;
    const next = {
      left: canScroll && scrollLeft > 1,
      right: canScroll && scrollLeft + clientWidth < scrollWidth - 1,
    };
    setHorizontalFades((prev) => {
      const current = prev[key];
      if (current && current.left === next.left && current.right === next.right)
        return prev;
      return { ...prev, [key]: next };
    });
  };

  useEffect(() => {
    STAT_FILTER_SECTIONS.forEach((section) => updateHorizontalFade(section.key));
    updateHorizontalFade("hostingStatus");
  }, [filterBadges.length, selectedFilters, showFilters]);

  useEffect(() => {
    if (hostingSelected.length === 0 && hosting) {
      setHosting(false);
    }
  }, [hostingSelected.length, hosting]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const [
          sexRes,
          posRes,
          roleRes,
          bodyRes,
          ethRes,
          dickSizeRes,
          dickCutRes,
          hostingRes,
        ] = await Promise.all([
          supabase
            .from("sexualities")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("positions")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("roles")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("body_types")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("ethnicities")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("dick_sizes")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("dick_cut_statuses")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
          supabase
            .from("hosting_statuses")
            .select("label")
            .order("sort_order", { ascending: true })
            .order("label", { ascending: true }),
        ]);

        if (sexRes.error) {
          console.warn("map filtering: sexualities fetch failed", sexRes.error);
        } else {
          const labels = (sexRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setSexualityOptions(labels);
          }
        }

        if (posRes.error) {
          console.warn("map filtering: positions fetch failed", posRes.error);
        } else {
          const labels = (posRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setPositionOptions(labels);
          }
        }

        if (roleRes.error) {
          console.warn("map filtering: roles fetch failed", roleRes.error);
        } else {
          const labels = (roleRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setRoleOptions(labels);
          }
        }

        if (bodyRes.error) {
          console.warn("map filtering: body types fetch failed", bodyRes.error);
        } else {
          const labels = (bodyRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setBodyTypeOptions(labels);
          }
        }

        if (ethRes.error) {
          console.warn("map filtering: ethnicities fetch failed", ethRes.error);
        } else {
          const labels = (ethRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setEthnicityOptions(labels);
          }
        }

        if (dickSizeRes.error) {
          console.warn("map filtering: dick sizes fetch failed", dickSizeRes.error);
        } else {
          const labels = (dickSizeRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setDickSizeOptions(labels);
          }
        }

        if (dickCutRes.error) {
          console.warn("map filtering: dick cut statuses fetch failed", dickCutRes.error);
        } else {
          const labels = (dickCutRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setDickCutOptions(labels);
          }
        }

        if (hostingRes.error) {
          console.warn("map filtering: hosting statuses fetch failed", hostingRes.error);
        } else {
          const labels = (hostingRes.data ?? [])
            .map((row: any) => row?.label)
            .filter((label: unknown): label is string => typeof label === "string");
          if (labels.length) {
            setHostingOptions(labels);
          }
        }
      } catch (err) {
        console.warn("map filtering: lookup fetch errored", err);
      }
    };
    void run();
  }, []);

  const toggleFilter = (sectionKey: string, option: string) => {
    let nextSize = 0;
    setSelectedFilters((prev) => {
      const current = new Set(prev[sectionKey] ?? []);
      const willAdd = !current.has(option);
      if (willAdd) current.add(option);
      else current.delete(option);
      nextSize = current.size;
      return { ...prev, [sectionKey]: Array.from(current) };
    });
    setSectionEnabled((prev) => ({
      ...prev,
      [sectionKey]: nextSize > 0,
    }));
  };

  const removeBadge = (sectionKey: string, option: string) => {
    let nextSize = 0;
    setSelectedFilters((prev) => {
      const current = new Set(prev[sectionKey] ?? []);
      current.delete(option);
      nextSize = current.size;
      return { ...prev, [sectionKey]: Array.from(current) };
    });
    setSectionEnabled((prev) => ({
      ...prev,
      [sectionKey]: nextSize > 0 ? prev[sectionKey] !== false : false,
    }));
  };

  const placeholder = filterBadges.length > 0 ? "" : "Looking for?";

  const renderSection = (section: FilterSection, opts?: { minimal?: boolean }) => {
    const minimal = opts?.minimal;
    const selected = new Set(selectedFilters[section.key] ?? []);
    const options =
      section.key === "sexuality"
        ? sexualityOptions
        : section.key === "position"
          ? positionOptions
          : section.key === "attitude"
            ? roleOptions
            : section.key === "bodyType"
              ? bodyTypeOptions
              : section.key === "ethnicity"
                ? ethnicityOptions
                : section.key === "dickSize"
                  ? dickSizeOptions
                  : section.key === "dickCut"
                    ? dickCutOptions
                    : section.options;
    const isEnabled = sectionEnabled[section.key] !== false;
    const hFade = horizontalFades[section.key] ?? { left: false, right: false };
    return (
      <div
        key={section.key}
        className={cn(
          minimal
            ? "space-y-3"
            : "rounded-2xl bg-background/70 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
          <div className="flex items-center gap-2">
            {selected.size > 0 && sectionEnabled[section.key] !== false ? (
              <span className="text-xs text-muted-foreground">
                {selected.size} selected
              </span>
            ) : null}
            <Switch
              checked={isEnabled}
              disabled={
                section.key === "dickSize"
                  ? false
                  : selected.size === 0 &&
                    !(section.key === "dickSize" && dickSizeTouched)
              }
              onCheckedChange={(val) => {
                if (section.key === "dickSize" && !val) {
                  setDickSizeTouched(false);
                }
                setSectionEnabled((prev) => ({
                  ...prev,
                  [section.key]: val,
                }));
              }}
              aria-label={`Toggle ${section.label} filter`}
            />
          </div>
        </div>
        <div className="relative -mx-4 px-4">
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card via-card/70 to-transparent transition-opacity ${
              hFade.left ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/70 to-transparent transition-opacity ${
              hFade.right ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            ref={(node) => {
              horizontalRefs.current[section.key] = node;
              updateHorizontalFade(section.key);
            }}
            onScroll={() => updateHorizontalFade(section.key)}
            className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="inline-flex items-center gap-2 pb-1 whitespace-nowrap">
              {options.map((option) => {
                const active = selected.has(option);
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-9 rounded-full px-3 text-xs border",
                      active && isEnabled
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : active && !isEnabled
                          ? "border-white/15 bg-white/15 text-muted-foreground"
                          : "border-white/15 bg-background/70 text-foreground hover:bg-background/90"
                    )}
                    onClick={() => toggleFilter(section.key, option)}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
        {section.key === "dickSize" ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dick length</span>
              <span className="font-semibold text-foreground">
                {dickSizeValue[0]} - {dickSizeValue[1]} inches
              </span>
            </div>
              <Slider
                min={0}
                max={14}
                step={1}
                value={dickSizeValue}
                onValueChange={(vals) =>
                  {
                    setDickSizeTouched(true);
                    setSectionEnabled((prev) => ({ ...prev, dickSize: true }));
                    setDickSizeValue([
                      vals[0] ?? dickSizeValue[0],
                      vals[1] ?? vals[0] ?? dickSizeValue[1],
                    ]);
                  }
                }
                className={cn(
                  !dickSizeTouched
                    ? [
                        "[&_[data-slot=slider-track]]:bg-muted/40",
                        "[&_[data-slot=slider-range]]:bg-muted/70",
                        "[&_[data-slot=slider-thumb]]:border-muted",
                        "[&_[data-slot=slider-thumb]]:ring-muted/40",
                      ].join(" ")
                    : undefined
                )}
                aria-label="Dick size slider"
              />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {Array.from({ length: 15 }).map((_, idx) => (
                <span key={idx}>{idx}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4",
          className
        )}
      >
        <div className="pointer-events-auto w-full max-w-md">
          <InputGroup className="relative h-14 items-center rounded-2xl border border-white/10 bg-background/80 px-3 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur">
            <InputGroupAddon align="inline-start" className="pl-1 pr-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={placeholder}
              aria-label="Filters"
              readOnly
              className="h-full rounded-2xl border-0 bg-transparent px-1.5 text-sm font-medium leading-none tracking-tight text-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowFilters(true);
              }}
              onFocus={() => setShowFilters(true)}
              onKeyDown={(e) => {
                if (e.key === "Tab") return;
                e.preventDefault();
                setShowFilters(true);
              }}
            />
            {filterBadges.length > 0 ? (
              <div
                className="pointer-events-none absolute inset-y-0 left-12 right-24 flex items-center overflow-x-auto whitespace-nowrap pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{
                  maskImage:
                    "linear-gradient(to right, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 85%, rgba(255,255,255,0) 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to right, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 85%, rgba(255,255,255,0) 100%)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  {filterBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur"
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <InputGroupAddon align="inline-end" className="pl-3 pr-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 rounded-xl px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <Clock className="h-3.5 w-3.5 text-white" />
                    <span className="truncate text-white">{whenOption}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  {WHEN_OPTIONS.map((label) => (
                    <DropdownMenuItem
                      key={label}
                      onClick={() => setWhenOption(label)}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      <Drawer open={showFilters} onOpenChange={setShowFilters}>
        <DrawerContent className="flex h-screen max-h-screen flex-col overflow-hidden p-0">
          <DrawerHeader className="pb-3 px-4">
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription />
          </DrawerHeader>
          <div className="relative flex-1 min-h-0 px-4 pb-0 pt-1">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto pr-1"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex flex-col gap-3 pb-4">
                <div className="px-1 pb-0 text-[11px] font-semibold uppercase text-muted-foreground">
                  Cruising
                </div>
                <div className="rounded-2xl bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Active now</h3>
                    <Switch
                      checked={activeNow}
                      onCheckedChange={(val) => setActiveNow(val)}
                      aria-label="Toggle active now filter"
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Hosting</h3>
                    <Switch
                      checked={hosting}
                      disabled={hostingSelected.length === 0}
                      onCheckedChange={(val) => setHosting(val)}
                      aria-label="Toggle hosting filter"
                    />
                  </div>
                  <div className="relative -mx-4 px-4">
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card via-card/70 to-transparent transition-opacity ${
                        (horizontalFades["hostingStatus"]?.left ?? false)
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <div
                      className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/70 to-transparent transition-opacity ${
                        (horizontalFades["hostingStatus"]?.right ?? false)
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <div
                      ref={(node) => {
                        horizontalRefs.current["hostingStatus"] = node;
                        updateHorizontalFade("hostingStatus");
                      }}
                      onScroll={() => updateHorizontalFade("hostingStatus")}
                      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <div className="inline-flex items-center gap-2 pb-1 whitespace-nowrap">
                        {hostingOptions.map((option) => {
                          const active = hostingSelected.includes(option);
                          return (
                            <Button
                              key={option}
                              type="button"
                              variant={active ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-9 rounded-full px-3 text-xs border",
                                active
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-white/15 bg-background/70 text-foreground hover:bg-background/90"
                              )}
                              onClick={() => {
                            setHosting(true);
                            setHostingSelected((prev) =>
                              prev.includes(option)
                                ? (() => {
                                    const next = prev.filter((o) => o !== option);
                                    if (next.length === 0) {
                                      setHosting(false);
                                    }
                                    return next;
                                  })()
                                : [...prev, option]
                            );
                          }}
                        >
                          {option}
                        </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Visiting</h3>
                    <Switch
                      checked={visiting}
                      onCheckedChange={(val) => setVisiting(val)}
                      aria-label="Toggle visiting filter"
                    />
                  </div>
                </div>

                <div className="px-1 pb-0 text-[11px] font-semibold uppercase text-muted-foreground">
                  Stats
                </div>
                <div className="rounded-2xl bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  {renderSection(
                    STAT_FILTER_SECTIONS.find((s) => s.key === "sexuality") ??
                      STAT_FILTER_SECTIONS[0],
                    { minimal: true }
                  )}
                </div>

                {STAT_FILTER_SECTIONS.filter(
                  (section) => section.key !== "sexuality"
                ).map((section) => (
                  <div
                    key={section.key}
                    className="rounded-2xl bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"
                  >
                    {renderSection(section, { minimal: true })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
