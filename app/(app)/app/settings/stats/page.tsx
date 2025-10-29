"use client";

import * as React from "react";
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
    setValue(roundVal(clamped));
  };

  const handleSlide = (vals: number[]) => {
    const v = roundVal(vals[0]);
    setValue(v);
  };

  const chips: Array<{ label: string }> = [
    { label: "XS" },
    { label: "Small" },
    { label: "Average" },
    { label: "Large" },
    { label: "XL" },
    { label: "XXL" },
  ];

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
          <div className="mt-3 text-center text-lg font-bold">
            {roundVal(inchesVal)} in
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Show dick size on profile
            </span>
            <Switch
              checked={showOnProfile}
              onCheckedChange={setShowOnProfile}
              aria-label="Show dick size on profile"
            />
          </div>
        </TabsContent>
        <TabsContent value="cm" className="mt-4">
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
          <div className="mt-3 text-center text-lg font-bold">
            {roundVal(cmVal)} cm
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Show dick measurment on profile
            </span>
            <Switch
              checked={showOnProfile}
              onCheckedChange={setShowOnProfile}
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
            onClick={() => setSelectedChip(c.label)}
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
        {["Pencil", "Thin", "Average", "Thick", "Extra thick"].map((t) => (
          <Badge
            key={t}
            role="button"
            onClick={() => setSelectedGirth(selectedGirth === t ? null : t)}
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
        {["Cut", "Uncut"].map((opt) => (
          <Badge
            key={opt}
            role="button"
            onClick={() =>
              setCutStatus(
                cutStatus === (opt as "Cut" | "Uncut")
                  ? null
                  : (opt as "Cut" | "Uncut")
              )
            }
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
          <div className="mt-3 text-center text-lg font-bold">
            {formatFeetIn(inchesVal)}
          </div>
        </TabsContent>

        <TabsContent value="cm" className="mt-4">
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
          <div className="mt-3 text-center text-lg font-bold">
            {Math.round(cmVal)} cm
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SexualityDrawerContent({
  selected,
  setSelected,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
}) {
  const options = [
    "Gay",
    "Bisexual",
    "Bi-curious",
    "Pansexual",
    "Queer",
    "Straight",
    "Straight-curious",
    "Asexual",
  ];

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => (
          <Badge
            key={opt}
            role="button"
            onClick={() => setSelected(selected === opt ? null : opt)}
            className={`rounded-full cursor-pointer select-none ${
              selected === opt
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

function PositionDrawerContent({
  selected,
  setSelected,
  attitudeSelected,
  setAttitudeSelected,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
  attitudeSelected: string | null;
  setAttitudeSelected: (v: string | null) => void;
}) {
  const options = [
    "Top",
    "Vers top",
    "Vers",
    "Vers bottom",
    "Bottom",
    "Dom top",
    "Sub bottom",
  ];

  return (
    <div className="px-4 pb-4">
      <h3 className="mb-2 text-center text-sm font-semibold text-foreground/80">
        Active to passive
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => (
          <Badge
            key={opt}
            role="button"
            onClick={() => setSelected(selected === opt ? null : opt)}
            className={`rounded-full cursor-pointer select-none ${
              selected === opt
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt}
          </Badge>
        ))}
      </div>
      <h3 className="mt-6 mb-2 text-center text-sm font-semibold text-foreground/80">
        Attitude
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {["Dominant", "Submissive", "Power"].map((opt) => (
          <Badge
            key={opt}
            role="button"
            onClick={() =>
              setAttitudeSelected(attitudeSelected === opt ? null : opt)
            }
            className={`rounded-full cursor-pointer select-none ${
              attitudeSelected === opt
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

function EthnicityDrawerContent({
  selected,
  setSelected,
  nationalities,
  setNationalities,
}: {
  selected: string | null;
  setSelected: (v: string | null) => void;
  nationalities: string[];
  setNationalities: (v: string[]) => void;
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

  return (
    <div className="px-4 pb-4 space-y-6">
      {/* Ethnic background title + chips */}
      <div>
        <h3 className="mb-2 text-center text-sm font-semibold text-foreground/80">
          Ethnic background
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "White",
            "Black",
            "Asian",
            "Latino",
            "Middle Eastern",
            "Mixed",
            "Indigenous",
            "Pacific Islander",
            "Other",
          ].map((opt) => (
            <Badge
              key={opt}
              role="button"
              onClick={() => setSelected(selected === opt ? null : opt)}
              className={`rounded-full cursor-pointer select-none ${
                selected === opt
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {opt}
            </Badge>
          ))}
        </div>
      </div>

      {/* Nationalities title + multi-select combobox */}
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

export default function StatsPage() {
  // State lifted from MyDickDrawerContent
  const [dickUnit, setDickUnit] = React.useState<"in" | "cm">("in");
  const [dickValue, setDickValue] = React.useState<number>(6);
  const [dickSizeChip, setDickSizeChip] = React.useState<string>("Average");
  const [dickGirth, setDickGirth] = React.useState<string | null>(null);
  const [dickCut, setDickCut] = React.useState<null | "Cut" | "Uncut">(null);
  const [dickShowOnProfile, setDickShowOnProfile] =
    React.useState<boolean>(false);

  const toCm = (inch: number) => Math.round(inch * 2.54);
  const toIn = (cm: number) => cm / 2.54;
  const roundVal = (unit: "in" | "cm", v: number) =>
    unit === "in" ? Math.round(v * 2) / 2 : Math.round(v);
  const inchesVal = dickUnit === "in" ? dickValue : toIn(dickValue);

  // Height state (same controlled pattern as dick)
  const [heightUnit, setHeightUnit] = React.useState<"in" | "cm">("in");
  const [heightValue, setHeightValue] = React.useState<number>(69); // default ~5'9"
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

  // Track whether user interacted with Height slider
  const [heightTouched, setHeightTouched] = React.useState(false);

  // Weight state
  const [weightValue, setWeightValue] = React.useState<number>(80);
  const [weightTouched, setWeightTouched] = React.useState(false);
  const weightSummary = `${Math.round(weightValue)} kg`;
  // WeightDrawerContent
  function WeightDrawerContent({
    value,
    setValue,
  }: {
    value: number;
    setValue: (n: number) => void;
  }) {
    const MIN = 40;
    const MAX = 160;

    const handleSlide = (vals: number[]) => {
      const v = Math.round(vals[0]);
      setValue(v);
    };

    return (
      <div className="px-4 pb-4">
        <Slider
          step={1}
          min={MIN}
          max={MAX}
          value={[value]}
          onValueChange={handleSlide}
        />
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-3">
          <span>{MIN} kg</span>
          <span>{Math.round((MIN + MAX) / 2)} kg</span>
          <span>{MAX} kg</span>
        </div>
        <div className="mt-3 text-center text-lg font-bold">
          {Math.round(value)} kg
        </div>
      </div>
    );
  }

  const [bodySel, setBodySel] = React.useState<string | null>(null);
  function BodyDrawerContent({
    selected,
    setSelected,
    heightUnit,
    heightValue,
    heightInchesVal,
    weightValue,
    heightTouched,
    weightTouched,
  }: {
    selected: string | null;
    setSelected: (v: string | null) => void;
    heightUnit: "in" | "cm";
    heightValue: number;
    heightInchesVal: number;
    weightValue: number; // kg
    heightTouched: boolean;
    weightTouched: boolean;
  }) {
    const chips = [
      "Skinny",
      "Slim",
      "Toned",
      "Athletic",
      "Average",
      "Muscled",
      "Stocky",
      "Large",
      "Extra Large",
    ];

    const didInit = React.useRef(false);

    React.useEffect(() => {
      if (didInit.current) return; // run once when drawer mounts
      if (!heightTouched || !weightTouched) return; // need both chosen
      if (selected) return; // do not override user selection

      // compute BMI once based on current height & weight
      const heightCm =
        heightUnit === "in"
          ? Math.round(heightInchesVal * 2.54)
          : Math.round(heightValue);
      if (!heightCm || heightCm <= 0) return;
      const hM = heightCm / 100;
      const bmi = weightValue / (hM * hM);

      let preselect: string;
      if (bmi < 18.5) preselect = "Skinny";
      else if (bmi < 21) preselect = "Slim";
      else if (bmi < 24) preselect = "Toned";
      else if (bmi < 27) preselect = "Athletic";
      else if (bmi < 30) preselect = "Average";
      else if (bmi < 34) preselect = "Muscled";
      else if (bmi < 37) preselect = "Stocky";
      else if (bmi < 40) preselect = "Large";
      else preselect = "Extra Large";

      setSelected(preselect);
      didInit.current = true;
    }, [
      selected,
      heightTouched,
      weightTouched,
      heightUnit,
      heightValue,
      heightInchesVal,
      weightValue,
      setSelected,
    ]);

    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-muted-foreground mb-3 text-center">
          Choose the body type that best fits you.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {chips.map((opt) => (
            <Badge
              key={opt}
              role="button"
              onClick={() => setSelected(selected === opt ? null : opt)}
              className={`rounded-full cursor-pointer select-none ${
                selected === opt
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

  const [sexuality, setSexuality] = React.useState<string | null>(null);
  const [positionSel, setPositionSel] = React.useState<string | null>(null);
  const [positionAttitude, setPositionAttitude] = React.useState<string | null>(
    null
  );
  const [ethnicitySel, setEthnicitySel] = React.useState<string | null>(null);
  const [nationalitiesSel, setNationalitiesSel] = React.useState<string[]>([]);

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
      if (dickUnit === "in") parts.push(`${roundVal("in", inchesVal)}ins`);
      else parts.push(`${roundVal("cm", toCm(inchesVal))}cm`);
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
                  />
                ) : item.title === "Sexuality" ? (
                  <SexualityDrawerContent
                    selected={sexuality}
                    setSelected={setSexuality}
                  />
                ) : item.title === "Position" ? (
                  <PositionDrawerContent
                    selected={positionSel}
                    setSelected={setPositionSel}
                    attitudeSelected={positionAttitude}
                    setAttitudeSelected={setPositionAttitude}
                  />
                ) : item.title === "Height" ? (
                  <HeightDrawerContent
                    unit={heightUnit}
                    setUnit={(u) => {
                      setHeightUnit(u);
                    }}
                    value={heightValue}
                    setValue={(n) => {
                      setHeightValue(n);
                      setHeightTouched(true);
                    }}
                  />
                ) : item.title === "Weight" ? (
                  <WeightDrawerContent
                    value={weightValue}
                    setValue={(n) => {
                      setWeightValue(n);
                      setWeightTouched(true);
                    }}
                  />
                ) : item.title === "My body" ? (
                  <BodyDrawerContent
                    selected={bodySel}
                    setSelected={setBodySel}
                    heightUnit={heightUnit}
                    heightValue={heightValue}
                    heightInchesVal={heightInchesVal}
                    weightValue={weightValue}
                    heightTouched={heightTouched}
                    weightTouched={weightTouched}
                  />
                ) : item.title === "Ethnicity" ? (
                  <EthnicityDrawerContent
                    selected={ethnicitySel}
                    setSelected={setEthnicitySel}
                    nationalities={nationalitiesSel}
                    setNationalities={setNationalitiesSel}
                  />
                ) : (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Edit {item.title} details here.
                  </p>
                )}
              </DrawerContent>
            </Drawer>
            {i !== rows.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}
