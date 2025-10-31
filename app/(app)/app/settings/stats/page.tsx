"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  Ruler,
  Heart,
  User,
  ArrowDownUp,
  Scale,
  Activity,
  Palette,
  ChevronDown,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
  CommandEmpty,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import countries from "@/lib/data/countries.json";

/* -------------------------------------------------------------------------- */
/*  MY DICK DRAWER – patched to load from DB + save to Supabase               */
/* -------------------------------------------------------------------------- */
function MyDickDrawerContent({
  unit,
  setUnit,
  value,
  setValue,
  selectedChip,
  setSelectedChip,
  selectedGirth,
  setSelectedGirth,
  cutStatus,
  setCutStatus,
  showOnProfile,
  setShowOnProfile,
  sizeOptions,
  girthOptions,
  cutOptions,
  onLengthChange,
  onSizeChange,
  onGirthChange,
  onCutChange,
  onShowChange,
}: {
  unit: "in" | "cm";
  setUnit: (u: "in" | "cm") => void;
  value: number;
  setValue: (n: number) => void;
  selectedChip: string;
  setSelectedChip: (s: string) => void;
  selectedGirth: string | null;
  setSelectedGirth: (s: string | null) => void;
  cutStatus: null | "Cut" | "Uncut";
  setCutStatus: (v: null | "Cut" | "Uncut") => void;
  showOnProfile: boolean;
  setShowOnProfile: (b: boolean) => void;
  sizeOptions?: { id: string; label: string }[];
  girthOptions?: { id: string; label: string }[];
  cutOptions?: { id: string; label: string }[];
  onLengthChange?: (len: number, unit: "in" | "cm") => void;
  onSizeChange?: (label: string) => void;
  onGirthChange?: (label: string | null) => void;
  onCutChange?: (label: string | null) => void;
  onShowChange?: (val: boolean) => void;
}) {
  const toCm = (inch: number) => Math.round(inch * 2.54);
  const toIn = (cm: number) => cm / 2.54;

  // Round based on unit (0.5 in or 1 cm)
  const roundVal = (v: number) =>
    unit === "in" ? Math.round(v * 2) / 2 : Math.round(v);

  const inchesVal = unit === "in" ? value : toIn(value);
  const cmVal = unit === "cm" ? value : toCm(value);

  const category = (() => {
    const inch = inchesVal;
    if (inch < 3.5) return "XS";
    if (inch < 5) return "Small";
    if (inch < 7) return "Average";
    if (inch < 8) return "Large";
    if (inch < 9) return "XL";
    return "XXL";
  })();

  const marksIn = [0, 2, 4, 6, 8, 10, 12, 14];
  const marksCm = [0, 5, 10, 15, 20, 25, 30, 35];

  const handleUnitChange = (u: "in" | "cm") => {
    if (u === unit) return;
    // Convert current value to new unit and round appropriately
    const converted = u === "in" ? toIn(value) : toCm(value);
    const clamped = Math.max(0, Math.min(u === "in" ? 14 : 36, converted));
    setUnit(u);
    const rounded = roundVal(clamped);
    setValue(rounded);
    if (onLengthChange) {
      onLengthChange(rounded, u);
    }
  };

  const handleSlide = (vals: number[]) => {
    const v = roundVal(vals[0]);
    setValue(v);
    if (onLengthChange) {
      onLengthChange(v, unit);
    }
  };

  // if we have DB options, use them; otherwise fallback to your original list
  const chips: Array<{ label: string }> = sizeOptions?.map((s) => ({
    label: s.label,
  })) ?? [
    { label: "XS" },
    { label: "Small" },
    { label: "Average" },
    { label: "Large" },
    { label: "XL" },
    { label: "XXL" },
  ];

  const girthLabels = girthOptions
    ? girthOptions.map((g) => g.label)
    : ["Pencil", "Thin", "Average", "Thick", "Extra thick"];

  const cutLabels = cutOptions
    ? cutOptions.map((c) => c.label)
    : ["Cut", "Uncut"];

  return (
    <div className="px-4 pb-4">
      <Tabs
        value={unit}
        onValueChange={(v) => handleUnitChange(v as "in" | "cm")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="in">Inches</TabsTrigger>
          <TabsTrigger value="cm">Centimeters</TabsTrigger>
        </TabsList>
        <TabsContent value="in" className="mt-4">
          <div className="mb-1 text-center text-lg font-bold">
            {roundVal(inchesVal)} in
          </div>
          <div className="mb-2 text-xs text-muted-foreground text-center">
            Average (6 in / 15 cm)
          </div>
          <Slider
            step={0.5}
            min={0}
            max={14}
            value={[inchesVal]}
            onValueChange={handleSlide}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-0">
            {marksIn.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Show dick size on profile
            </span>
            <Switch
              checked={showOnProfile}
              onCheckedChange={(val) => {
                setShowOnProfile(val);
                if (onShowChange) onShowChange(val);
              }}
              aria-label="Show dick size on profile"
            />
          </div>
        </TabsContent>
        <TabsContent value="cm" className="mt-4">
          <div className="mb-1 text-center text-lg font-bold">
            {roundVal(cmVal)} cm
          </div>
          <div className="mb-2 text-xs text-muted-foreground text-center">
            Average (6 in / 15 cm)
          </div>
          <Slider
            step={1}
            min={0}
            max={36}
            value={[cmVal]}
            onValueChange={handleSlide}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-0">
            {marksCm.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Show dick measurment on profile
            </span>
            <Switch
              checked={showOnProfile}
              onCheckedChange={(val) => {
                setShowOnProfile(val);
                if (onShowChange) onShowChange(val);
              }}
              aria-label="Show dick size on profile"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Chips */}
      <h3 className="mt-6 mb-2 text-center text-sm font-semibold text-foreground/80">
        Size
      </h3>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <Badge
            key={c.label}
            role="button"
            onClick={() => {
              setSelectedChip(c.label);
              if (onSizeChange) onSizeChange(c.label);
            }}
            className={`rounded-full cursor-pointer select-none ${
              c.label === selectedChip
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {c.label}
          </Badge>
        ))}
      </div>

      {/* Thickness chips */}
      <h3 className="mt-6 mb-2 text-center text-sm font-semibold text-foreground/80">
        Girth
      </h3>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {girthLabels.map((t) => (
          <Badge
            key={t}
            role="button"
            onClick={() => {
              const next = selectedGirth === t ? null : t;
              setSelectedGirth(next);
              if (onGirthChange) onGirthChange(next);
            }}
            className={`rounded-full cursor-pointer select-none ${
              t === selectedGirth
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t}
          </Badge>
        ))}
      </div>

      <h3 className="mt-6 mb-2 text-center text-sm font-semibold text-foreground/80">
        Cut / Uncut
      </h3>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {cutLabels.map((opt) => (
          <Badge
            key={opt}
            role="button"
            onClick={() => {
              const next =
                cutStatus === (opt as "Cut" | "Uncut")
                  ? null
                  : (opt as "Cut" | "Uncut");
              setCutStatus(next);
              if (onCutChange) onCutChange(next);
            }}
            className={`rounded-full px-4 py-2 text-sm cursor-pointer select-none ${
              cutStatus === opt
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  HEIGHT DRAWER (unchanged)                                                 */
/* -------------------------------------------------------------------------- */
function HeightDrawerContent({
  unit,
  setUnit,
  value,
  setValue,
}: {
  unit: "in" | "cm";
  setUnit: (u: "in" | "cm") => void;
  value: number; // stores the current unit's value
  setValue: (n: number) => void;
}) {
  const toCm = (inch: number) => Math.round(inch * 2.54);
  const toIn = (cm: number) => cm / 2.54;
  const roundVal = (v: number) =>
    unit === "in" ? Math.round(v * 2) / 2 : Math.round(v);

  // Limits: 4'7" = 55 in, 7'0" = 84 in. CM ≈ 140–213
  const IN_MIN = 55;
  const IN_MAX = 84;
  const CM_MIN = 140;
  const CM_MAX = 213;

  const inchesVal = unit === "in" ? value : toIn(value);
  const cmVal = unit === "cm" ? value : toCm(value);

  const handleUnitChange = (u: "in" | "cm") => {
    if (u === unit) return;
    const converted = u === "in" ? toIn(value) : toCm(value);
    const clamped = Math.max(
      0,
      Math.min(
        u === "in" ? IN_MAX : CM_MAX,
        Math.max(u === "in" ? IN_MIN : CM_MIN, converted)
      )
    );
    setUnit(u);
    setValue(roundVal(clamped));
  };

  const handleSlide = (vals: number[]) => {
    setValue(roundVal(vals[0]));
  };

  const formatFeetIn = (totalInches: number) => {
    const v = Math.round(totalInches * 2) / 2; // keep 0.5 precision
    const feet = Math.floor(v / 12);
    const inches = Math.round((v - feet * 12) * 2) / 2;
    return `${feet}ft ${
      inches === Math.floor(inches) ? `${inches}` : `${inches}`
    }ins`;
  };

  return (
    <div className="px-4 pb-4">
      <Tabs
        value={unit}
        onValueChange={(v) => handleUnitChange(v as "in" | "cm")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="in">Feet/Inches</TabsTrigger>
          <TabsTrigger value="cm">Centimeters</TabsTrigger>
        </TabsList>

        <TabsContent value="in" className="mt-4">
          <div className="mb-2 text-center text-lg font-bold">
            {formatFeetIn(inchesVal)}
          </div>
          <Slider
            step={0.5}
            min={IN_MIN}
            max={IN_MAX}
            value={[inchesVal]}
            onValueChange={handleSlide}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-3">
            <span>4'7"</span>
            <span>6'0"</span>
            <span>7'0"</span>
          </div>
        </TabsContent>

        <TabsContent value="cm" className="mt-4">
          <div className="mb-2 text-center text-lg font-bold">
            {Math.round(cmVal)} cm
          </div>
          <Slider
            step={1}
            min={CM_MIN}
            max={CM_MAX}
            value={[cmVal]}
            onValueChange={handleSlide}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-3">
            <span>{CM_MIN} cm</span>
            <span>~{Math.round((CM_MIN + CM_MAX) / 2)} cm</span>
            <span>{CM_MAX} cm</span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SEXUALITY DRAWER – now dynamic                                            */
/* -------------------------------------------------------------------------- */
function SexualityDrawerContent({
  selected,
  setSelected,
  options,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => (
          <Badge
            key={opt.id}
            role="button"
            onClick={() =>
              setSelected(selected === opt.label ? null : opt.label)
            }
            className={`rounded-full cursor-pointer select-none ${
              selected === opt.label
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  POSITION DRAWER – already patched                                         */
/* -------------------------------------------------------------------------- */
function PositionDrawerContent({
  selected,
  setSelected,
  attitudeSelected,
  setAttitudeSelected,
  positions,
  attitudes,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
  attitudeSelected: string | null;
  setAttitudeSelected: (v: string | null) => void;
  positions: { id: string; label: string }[];
  attitudes: { id: string; label: string }[];
}) {
  return (
    <div className="px-4 pb-4">
      <h3 className="mb-2 text-center text-sm font-semibold text-foreground/80">
        Active to passive
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {positions.map((opt) => (
          <Badge
            key={opt.id}
            role="button"
            onClick={() =>
              setSelected(selected === opt.label ? null : opt.label)
            }
            className={`rounded-full cursor-pointer select-none ${
              selected === opt.label
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
      <h3 className="mt-6 mb-2 text-center text-sm font-semibold text-foreground/80">
        Attitude
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {attitudes.map((opt) => (
          <Badge
            key={opt.id}
            role="button"
            onClick={() =>
              setAttitudeSelected(
                attitudeSelected === opt.label ? null : opt.label
              )
            }
            className={`rounded-full cursor-pointer select-none ${
              attitudeSelected === opt.label
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ETHNICITY DRAWER – unchanged                                              */
/* -------------------------------------------------------------------------- */
function EthnicityDrawerContent({
  selected,
  setSelected,
  nationalities,
  setNationalities,
  ethnicities,
  userId,
  loading,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
  nationalities: string[];
  setNationalities: (v: string[]) => void;
  ethnicities: { id: string; label: string }[];
  userId: string | null;
  loading: boolean;
}) {
  const countryOptions = React.useMemo(
    () =>
      countries
        .map((c: { name: string }) => c.name.trim())
        .sort((a: string, b: string) =>
          a.localeCompare(b, "en", { sensitivity: "base" })
        ),
    []
  );

  const toggleNationality = (name: string) => {
    setNationalities(
      nationalities.includes(name)
        ? nationalities.filter((n) => n !== name)
        : [...nationalities, name]
    );
  };

  const handleEthnicityClick = async (label: string) => {
    setSelected(label);
    const found = ethnicities.find((e) => e.label === label);
    if (!found || !userId) return;
    const supabase = createClient();
    await supabase.from("profiles").upsert({
      id: userId,
      ethnicity_id: found.id,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="px-4 pb-4 space-y-6">
      <div>
        <h3 className="mb-2 text-center text-sm font-semibold text-foreground/80">
          Ethnic background
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {loading ? (
            <div className="h-6 w-28 rounded bg-muted animate-pulse" />
          ) : (
            ethnicities.map((opt) => (
              <Badge
                key={opt.id}
                role="button"
                onClick={() => handleEthnicityClick(opt.label)}
                className={`rounded-full cursor-pointer select-none ${
                  selected === opt.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {opt.label}
              </Badge>
            ))
          )}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-center text-sm font-semibold text-foreground/80">
          Nationalities
        </h3>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {nationalities.length > 0
                ? `${nationalities.length} selected`
                : "Select nationalities"}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-(--radix-popover-trigger-width)"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search nationalities..." />
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {countryOptions.map((name) => {
                    const active = nationalities.includes(name);
                    return (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => toggleNationality(name)}
                        className="flex items-center justify-between"
                      >
                        <span>{name}</span>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {nationalities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {nationalities.map((n) => (
              <Badge
                key={n}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleNationality(n)}
                title="Remove"
              >
                {n}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PAGE                                                                      */
/* -------------------------------------------------------------------------- */
export default function StatsPage() {
  const [statsLoading, setStatsLoading] = React.useState(true);
  /* ---------- dick state ---------- */
  const [dickUnit, setDickUnit] = React.useState<"in" | "cm">("in");
  const [dickValue, setDickValue] = React.useState<number>(6);
  const [dickSizeChip, setDickSizeChip] = React.useState<string>("Average");
  const [dickGirth, setDickGirth] = React.useState<string | null>(null);
  const [dickCut, setDickCut] = React.useState<null | "Cut" | "Uncut">(null);
  const [dickShowOnProfile, setDickShowOnProfile] =
    React.useState<boolean>(false);

  const toCm = (inch: number) => Math.round(inch * 2.54);
  const toIn = (cm: number) => cm / 2.54;

  const inchesVal = dickUnit === "in" ? dickValue : toIn(dickValue);

  /* ---------- height state ---------- */
  const [heightUnit, setHeightUnit] = React.useState<"in" | "cm">("in");
  const [heightValue, setHeightValue] = React.useState<number>(69);
  const heightToCm = (inch: number) => Math.round(inch * 2.54);
  const heightToIn = (cm: number) => cm / 2.54;
  const heightRound = (u: "in" | "cm", v: number) =>
    u === "in" ? Math.round(v * 2) / 2 : Math.round(v);
  const heightInchesVal =
    heightUnit === "in" ? heightValue : heightToIn(heightValue);
  const formatHeightFeetIn = (totalInches: number) => {
    const v = Math.round(totalInches * 2) / 2;
    const feet = Math.floor(v / 12);
    const inches = Math.round((v - feet * 12) * 2) / 2;
    return `${feet}ft ${
      inches === Math.floor(inches) ? `${inches}` : `${inches}`
    }ins`;
  };
  const heightSummary =
    heightUnit === "in"
      ? `${formatHeightFeetIn(heightInchesVal)}`
      : `${heightRound("cm", heightToCm(heightInchesVal))} cm`;
  const [heightTouched, setHeightTouched] = React.useState(false);

  /* ---------- weight state ---------- */
  const [weightUnit, setWeightUnit] = React.useState<"kg" | "lb">("kg");
  const [weightValue, setWeightValue] = React.useState<number>(80);
  const [weightTouched, setWeightTouched] = React.useState(false);
  const weightSummary =
    weightUnit === "kg"
      ? `${Math.round(weightValue)} kg`
      : `${Math.round(weightValue)} lbs`;

  function WeightDrawerContent({
    unit,
    setUnit,
    value,
    setValue,
    onCommit,
  }: {
    unit: "kg" | "lb";
    setUnit: (u: "kg" | "lb") => void;
    value: number;
    setValue: (n: number) => void;
    onCommit?: (n: number, unit: "kg" | "lb") => void;
  }) {
    const KG_MIN = 40;
    const KG_MAX = 160;
    const LB_MIN = 90;
    const LB_MAX = 350;

    const handleUnitChange = (u: "kg" | "lb") => {
      if (u === unit) return;
      const converted =
        u === "kg" ? Math.round(value / 2.20462) : Math.round(value * 2.20462);
      const clamped =
        u === "kg"
          ? Math.min(Math.max(converted, KG_MIN), KG_MAX)
          : Math.min(Math.max(converted, LB_MIN), LB_MAX);
      setUnit(u);
      setValue(clamped);
      if (onCommit) onCommit(clamped, u);
    };

    const handleSlide = (vals: number[]) => {
      const v = Math.round(vals[0]);
      setValue(v);
    };

    return (
      <div className="px-4 pb-4">
        <Tabs
          value={unit}
          onValueChange={(v) => handleUnitChange(v as "kg" | "lb")}
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="kg">Kilograms</TabsTrigger>
            <TabsTrigger value="lb">Pounds</TabsTrigger>
          </TabsList>
          <TabsContent value="kg" className="mt-4">
            <div className="mb-2 text-center text-lg font-bold">
              {Math.round(value)} kg
            </div>
            <Slider
              step={1}
              min={KG_MIN}
              max={KG_MAX}
              value={[value]}
              onValueChange={handleSlide}
              onValueCommit={(vals) => {
                const v = Math.round(vals[0]);
                if (onCommit) onCommit(v, "kg");
              }}
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-3">
              <span>{KG_MIN} kg</span>
              <span>{Math.round((KG_MIN + KG_MAX) / 2)} kg</span>
              <span>{KG_MAX} kg</span>
            </div>
          </TabsContent>
          <TabsContent value="lb" className="mt-4">
            <div className="mb-2 text-center text-lg font-bold">
              {Math.round(value)} lbs
            </div>
            <Slider
              step={1}
              min={LB_MIN}
              max={LB_MAX}
              value={[value]}
              onValueChange={handleSlide}
              onValueCommit={(vals) => {
                const v = Math.round(vals[0]);
                if (onCommit) onCommit(v, "lb");
              }}
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-3">
              <span>{LB_MIN} lbs</span>
              <span>{Math.round((LB_MIN + LB_MAX) / 2)} lbs</span>
              <span>{LB_MAX} lbs</span>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  /* ---------- lookups ---------- */
  const [bodyTypeOptions, setBodyTypeOptions] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [bodySel, setBodySel] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [positionOptions, setPositionOptions] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [attitudeOptions, setAttitudeOptions] = React.useState<
    { id: string; label: string }[]
  >([]);

  // NEW: dick lookup options
  const [dickSizeOptions, setDickSizeOptions] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [dickGirthOptions, setDickGirthOptions] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [dickCutOptions, setDickCutOptions] = React.useState<
    { id: string; label: string }[]
  >([]);

  function BodyDrawerContent({
    selected,
    setSelected,
    bodyTypes,
  }: {
    selected: string | null;
    setSelected: (v: string | null) => void;
    bodyTypes: { id: string; label: string }[];
  }) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-muted-foreground mb-3 text-center">
          Choose the body type that best fits you.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {bodyTypes.map((bt) => (
            <Badge
              key={bt.id}
              role="button"
              onClick={() =>
                setSelected(selected === bt.label ? null : bt.label)
              }
              className={`rounded-full cursor-pointer select-none ${
                selected === bt.label
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {bt.label}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  const [sexuality, setSexuality] = React.useState<string | null>(null);
  const [positionSel, setPositionSel] = React.useState<string | null>(null);
  const [positionAttitude, setPositionAttitude] = React.useState<string | null>(
    null
  );
  const [ethnicitySel, setEthnicitySel] = React.useState<string | null>(null);
  const [nationalitiesSel, setNationalitiesSel] = React.useState<string[]>([]);
  const [ethnicityOptions, setEthnicityOptions] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [ethnicityLoading, setEthnicityLoading] = React.useState(true);
  const [sexualityOptions, setSexualityOptions] = React.useState<
    { id: string; label: string }[]
  >([]);

  React.useEffect(() => {
    const loadStatsLookups = async () => {
      setStatsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "ethnicity_id, body_type_id, position_id, attitude_id, sexuality_id, height_cm, weight_kg, height_input_unit, weight_input_unit, dick_length_cm, dick_length_input_unit, dick_size_id, dick_girth_id, dick_cut_status_id, dick_show"
          )
          .eq("id", user.id)
          .maybeSingle();

        // ETHNICITIES
        const { data: ethData } = await supabase
          .from("ethnicities")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (ethData) {
          setEthnicityOptions(ethData as { id: string; label: string }[]);
          if (profile?.ethnicity_id) {
            const match = ethData.find(
              (e: any) => e.id === profile.ethnicity_id
            );
            if (match) {
              setEthnicitySel(match.label);
            }
          }
        }

        // SEXUALITIES
        const { data: sexData } = await supabase
          .from("sexualities")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (sexData) {
          setSexualityOptions(sexData as { id: string; label: string }[]);
          if (profile?.sexuality_id) {
            const match = sexData.find(
              (s: any) => s.id === profile.sexuality_id
            );
            if (match) {
              setSexuality(match.label);
            }
          }
        }

        // BODY TYPES
        const { data: bodyData } = await supabase
          .from("body_types")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (bodyData) {
          setBodyTypeOptions(bodyData as { id: string; label: string }[]);
          if (profile?.body_type_id) {
            const match = bodyData.find(
              (b: any) => b.id === profile.body_type_id
            );
            if (match) {
              setBodySel(match.label);
            }
          }
        }

        // POSITIONS
        const { data: posData } = await supabase
          .from("positions")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (posData) {
          setPositionOptions(posData as { id: string; label: string }[]);
          if (profile?.position_id) {
            const match = posData.find(
              (p: any) => p.id === profile.position_id
            );
            if (match) {
              setPositionSel(match.label);
            }
          }
        }

        // ATTITUDES
        const { data: attData } = await supabase
          .from("attitudes")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (attData) {
          setAttitudeOptions(attData as { id: string; label: string }[]);
          if (profile?.attitude_id) {
            const match = attData.find(
              (a: any) => a.id === profile.attitude_id
            );
            if (match) {
              setPositionAttitude(match.label);
            }
          }
        }

        // DICK LOOKUPS
        const { data: dickSizeData } = await supabase
          .from("dick_sizes")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickSizeData) {
          setDickSizeOptions(dickSizeData as { id: string; label: string }[]);
          if (profile?.dick_size_id) {
            const match = dickSizeData.find(
              (d: any) => d.id === profile.dick_size_id
            );
            if (match) {
              setDickSizeChip(match.label);
            }
          }
        }

        const { data: dickGirthData } = await supabase
          .from("dick_girths")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickGirthData) {
          setDickGirthOptions(dickGirthData as { id: string; label: string }[]);
          if (profile?.dick_girth_id) {
            const match = dickGirthData.find(
              (d: any) => d.id === profile.dick_girth_id
            );
            if (match) {
              setDickGirth(match.label);
            }
          }
        }

        const { data: dickCutData } = await supabase
          .from("dick_cut_statuses")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickCutData) {
          setDickCutOptions(dickCutData as { id: string; label: string }[]);
          if (profile?.dick_cut_status_id) {
            const match = dickCutData.find(
              (d: any) => d.id === profile.dick_cut_status_id
            );
            if (match) {
              setDickCut(match.label as "Cut" | "Uncut");
            }
          }
        }

        // HYDRATE DICK LENGTH + UNIT + SHOW
        if (profile?.dick_length_cm) {
          const lenCm = Number(profile.dick_length_cm);
          const inputUnit =
            profile.dick_length_input_unit === "in" ||
            profile.dick_length_input_unit === "cm"
              ? profile.dick_length_input_unit
              : "cm";
          if (inputUnit === "cm") {
            setDickUnit("cm");
            setDickValue(lenCm);
          } else {
            const inches = lenCm / 2.54;
            setDickUnit("in");
            setDickValue(Math.round(inches * 2) / 2);
          }
        }
        if (typeof profile?.dick_show === "boolean") {
          setDickShowOnProfile(profile.dick_show);
        }

        // HYDRATE HEIGHT
        if (profile?.height_cm) {
          const inputUnit =
            profile.height_input_unit === "in" ||
            profile.height_input_unit === "cm"
              ? profile.height_input_unit
              : "cm";
          if (inputUnit === "cm") {
            setHeightUnit("cm");
            setHeightValue(Math.round(profile.height_cm));
          } else {
            const inches = profile.height_cm / 2.54;
            setHeightUnit("in");
            setHeightValue(Math.round(inches * 2) / 2);
          }
          setHeightTouched(true);
        }

        // HYDRATE WEIGHT
        if (profile?.weight_kg) {
          const inputUnit =
            profile.weight_input_unit === "lb" ||
            profile.weight_input_unit === "kg"
              ? profile.weight_input_unit
              : "kg";
          if (inputUnit === "kg") {
            setWeightUnit("kg");
            setWeightValue(Math.round(profile.weight_kg));
          } else {
            const lbs = profile.weight_kg * 2.20462;
            setWeightUnit("lb");
            setWeightValue(Math.round(lbs));
          }
          setWeightTouched(true);
        }
        setStatsLoading(false);
      } else {
        // logged-out – still load lookups so drawer renders
        const client = createClient();
        const { data: ethData } = await client
          .from("ethnicities")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (ethData) {
          setEthnicityOptions(ethData as { id: string; label: string }[]);
        }

        const { data: sexData } = await client
          .from("sexualities")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (sexData) {
          setSexualityOptions(sexData as { id: string; label: string }[]);
        }

        const { data: bodyData } = await client
          .from("body_types")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (bodyData) {
          setBodyTypeOptions(bodyData as { id: string; label: string }[]);
        }

        const { data: posData } = await client
          .from("positions")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (posData) {
          setPositionOptions(posData as { id: string; label: string }[]);
        }

        const { data: attData } = await client
          .from("attitudes")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (attData) {
          setAttitudeOptions(attData as { id: string; label: string }[]);
        }

        const { data: dickSizeData } = await client
          .from("dick_sizes")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickSizeData) {
          setDickSizeOptions(dickSizeData as { id: string; label: string }[]);
        }

        const { data: dickGirthData } = await client
          .from("dick_girths")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickGirthData) {
          setDickGirthOptions(dickGirthData as { id: string; label: string }[]);
        }

        const { data: dickCutData } = await client
          .from("dick_cut_statuses")
          .select("id, label")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });
        if (dickCutData) {
          setDickCutOptions(dickCutData as { id: string; label: string }[]);
        }
        setStatsLoading(false);
      }
      setEthnicityLoading(false);
    };
    loadStatsLookups();
  }, []);

  /* ---------- SAVERS (after effect) ---------- */

  const saveSexuality = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          sexuality_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = sexualityOptions.find((s) => s.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        sexuality_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, sexualityOptions]
  );

  // NEW: save dick fields
  const saveDickLength = React.useCallback(
    async (val: number, unit: "in" | "cm") => {
      if (!currentUserId) return;
      const supabase = createClient();
      const cm =
        unit === "in"
          ? Math.round(val * 2.54 * 10) / 10
          : Math.round(val * 10) / 10;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        dick_length_cm: cm,
        dick_length_input_unit: unit,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId]
  );

  const saveDickSize = React.useCallback(
    async (label: string) => {
      if (!currentUserId) return;
      const match = dickSizeOptions.find((d) => d.label === label);
      if (!match) return;
      const supabase = createClient();
      await supabase.from("profiles").upsert({
        id: currentUserId,
        dick_size_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, dickSizeOptions]
  );

  const saveDickGirth = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          dick_girth_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = dickGirthOptions.find((d) => d.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        dick_girth_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, dickGirthOptions]
  );

  const saveDickCut = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          dick_cut_status_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = dickCutOptions.find((d) => d.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        dick_cut_status_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, dickCutOptions]
  );

  const saveDickShow = React.useCallback(
    async (val: boolean) => {
      if (!currentUserId) return;
      const supabase = createClient();
      await supabase.from("profiles").upsert({
        id: currentUserId,
        dick_show: val,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId]
  );

  // Save height
  const saveHeight = React.useCallback(
    async (cm: number, inputUnit: "in" | "cm") => {
      if (!currentUserId) return;
      const supabase = createClient();
      await supabase.from("profiles").upsert({
        id: currentUserId,
        height_cm: cm,
        height_input_unit: inputUnit,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId]
  );

  // Save weight
  const saveWeight = React.useCallback(
    async (kg: number, inputUnit: "kg" | "lb") => {
      if (!currentUserId) return;
      const supabase = createClient();
      await supabase.from("profiles").upsert({
        id: currentUserId,
        weight_kg: kg,
        weight_input_unit: inputUnit,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId]
  );

  // existing savers for body/position/attitude
  const saveBodyType = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          body_type_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = bodyTypeOptions.find((b) => b.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        body_type_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, bodyTypeOptions]
  );

  const savePosition = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          position_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = positionOptions.find((p) => p.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        position_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, positionOptions]
  );

  const saveAttitude = React.useCallback(
    async (label: string | null) => {
      if (!currentUserId) return;
      const supabase = createClient();
      if (!label) {
        await supabase.from("profiles").upsert({
          id: currentUserId,
          attitude_id: null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const match = attitudeOptions.find((a) => a.label === label);
      if (!match) return;
      await supabase.from("profiles").upsert({
        id: currentUserId,
        attitude_id: match.id,
        updated_at: new Date().toISOString(),
      });
    },
    [currentUserId, attitudeOptions]
  );

  // summaries
  const dickCategory = (() => {
    const inch = inchesVal;
    if (inch < 3.5) return "XS";
    if (inch < 5) return "Small";
    if (inch < 7) return "Average";
    if (inch < 8) return "Large";
    if (inch < 9) return "XL";
    return "XXL";
  })();

  const dickSummary = (() => {
    const parts: string[] = [];
    if (dickShowOnProfile) {
      if (dickUnit === "in") parts.push(`${Math.round(inchesVal * 2) / 2}ins`);
      else parts.push(`${toCm(inchesVal)}cm`);
    } else if (Math.abs(inchesVal - 6) > 0.0001) {
      parts.push(dickCategory);
    }
    if (dickCut) parts.push(dickCut.toLowerCase());
    return parts.join(" ");
  })();

  const rows: {
    title: string;
    icon: React.ComponentType<any>;
    description: string;
  }[] = [
    { title: "My dick", icon: Ruler, description: "Length, girth, and type" },
    { title: "Sexuality", icon: Heart, description: "Who you’re attracted to" },
    {
      title: "Position",
      icon: ArrowDownUp,
      description: "Top, bottom, or versatile",
    },
    { title: "Height", icon: User, description: "Your height in cm or ft" },
    { title: "Weight", icon: Scale, description: "Your weight in kg or lbs" },
    { title: "My body", icon: Activity, description: "Body type or build" },
    {
      title: "Ethnicity",
      icon: Palette,
      description: "Your ethnic background",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar leftContent={<BackButton />}>
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Stats
        </h1>
      </TopBar>

      {statsLoading ? (
        <ItemGroup className="border-y border-border -mx-4 mt-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <React.Fragment key={i}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-44 bg-muted/70 rounded animate-pulse" />
                </div>
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
              </div>
              {i !== 7 && <ItemSeparator />}
            </React.Fragment>
          ))}
        </ItemGroup>
      ) : (
        <ItemGroup className="border-y border-border -mx-4 mt-4">
          {rows.map((item, i) => (
            <React.Fragment key={item.title}>
              <Drawer>
                <DrawerTrigger asChild>
                  <Item className="px-4 py-3">
                    <ItemMedia variant="icon">
                      <item.icon className="h-4 w-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{item.title}</ItemTitle>
                      <ItemDescription>{item.description}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {item.title === "My dick" && dickSummary ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {dickSummary}
                        </span>
                      ) : item.title === "Sexuality" && sexuality ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {sexuality}
                        </span>
                      ) : item.title === "Position" &&
                        (positionSel || positionAttitude) ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {positionAttitude && positionSel
                            ? `${positionAttitude.split(" ")[0]} ${positionSel}`
                            : positionSel || positionAttitude}
                        </span>
                      ) : item.title === "Height" && heightTouched ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {heightSummary}
                        </span>
                      ) : item.title === "Weight" && weightTouched ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {weightSummary}
                        </span>
                      ) : item.title === "My body" && bodySel ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {bodySel}
                        </span>
                      ) : item.title === "Ethnicity" && ethnicitySel ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {ethnicitySel}
                        </span>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </ItemActions>
                  </Item>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>{item.title}</DrawerTitle>
                  </DrawerHeader>
                  {item.title === "My dick" ? (
                    <MyDickDrawerContent
                      unit={dickUnit}
                      setUnit={setDickUnit}
                      value={dickValue}
                      setValue={setDickValue}
                      selectedChip={dickSizeChip}
                      setSelectedChip={setDickSizeChip}
                      selectedGirth={dickGirth}
                      setSelectedGirth={setDickGirth}
                      cutStatus={dickCut}
                      setCutStatus={setDickCut}
                      showOnProfile={dickShowOnProfile}
                      setShowOnProfile={setDickShowOnProfile}
                      sizeOptions={dickSizeOptions}
                      girthOptions={dickGirthOptions}
                      cutOptions={dickCutOptions}
                      onLengthChange={saveDickLength}
                      onSizeChange={saveDickSize}
                      onGirthChange={saveDickGirth}
                      onCutChange={saveDickCut}
                      onShowChange={saveDickShow}
                    />
                  ) : item.title === "Sexuality" ? (
                    <SexualityDrawerContent
                      selected={sexuality}
                      setSelected={(val) => {
                        setSexuality(val);
                        saveSexuality(val);
                      }}
                      options={sexualityOptions}
                    />
                  ) : item.title === "Position" ? (
                    <PositionDrawerContent
                      selected={positionSel}
                      setSelected={(val) => {
                        setPositionSel(val);
                        savePosition(val);
                      }}
                      attitudeSelected={positionAttitude}
                      setAttitudeSelected={(val) => {
                        setPositionAttitude(val);
                        saveAttitude(val);
                      }}
                      positions={positionOptions}
                      attitudes={attitudeOptions}
                    />
                  ) : item.title === "Height" ? (
                    <HeightDrawerContent
                      unit={heightUnit}
                      setUnit={(u) => {
                        setHeightUnit(u);
                        const cm =
                          u === "cm"
                            ? Math.round(heightValue)
                            : Math.round(heightValue * 2.54 * 100) / 100;
                        saveHeight(cm, u);
                      }}
                      value={heightValue}
                      setValue={(n) => {
                        setHeightValue(n);
                        setHeightTouched(true);
                        const cm =
                          heightUnit === "cm"
                            ? Math.round(n)
                            : Math.round(n * 2.54 * 100) / 100;
                        saveHeight(cm, heightUnit);
                      }}
                    />
                  ) : item.title === "Weight" ? (
                    <WeightDrawerContent
                      unit={weightUnit}
                      setUnit={(u) => {
                        setWeightUnit(u);
                        const kg =
                          u === "kg"
                            ? Math.round(weightValue)
                            : Math.round(weightValue / 2.20462);
                        saveWeight(kg, u);
                      }}
                      value={weightValue}
                      setValue={(n) => {
                        setWeightValue(n);
                        setWeightTouched(true);
                      }}
                      onCommit={(finalVal, unit) => {
                        const kg =
                          unit === "kg"
                            ? Math.round(finalVal)
                            : Math.round(finalVal / 2.20462);
                        saveWeight(kg, unit);
                      }}
                    />
                  ) : item.title === "My body" ? (
                    <BodyDrawerContent
                      selected={bodySel}
                      setSelected={(val) => {
                        setBodySel(val);
                        saveBodyType(val);
                      }}
                      bodyTypes={bodyTypeOptions}
                    />
                  ) : item.title === "Ethnicity" ? (
                    <EthnicityDrawerContent
                      selected={ethnicitySel}
                      setSelected={setEthnicitySel}
                      nationalities={nationalitiesSel}
                      setNationalities={setNationalitiesSel}
                      ethnicities={ethnicityOptions}
                      userId={currentUserId}
                      loading={ethnicityLoading}
                    />
                  ) : null}
                </DrawerContent>
              </Drawer>
              {i !== rows.length - 1 && <ItemSeparator />}
            </React.Fragment>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
