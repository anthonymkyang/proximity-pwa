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
  Heart,
  Sparkles,
  Shield,
  Users,
  Coffee,
  Clock,
  Ban,
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
import * as intoOptionsRaw from "@/lib/data/into.json";
import { Input } from "@/components/ui/input";

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Normalize JSON import across build setups
const intoOptions: {
  attributes?: string[];
  myType?: string[];
  fetishes?: string[];
  actions?: string[];
  scenarios?: string[];
} = (intoOptionsRaw as any).default ?? (intoOptionsRaw as any);

const safeArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]) : [];

// Helpers
function SummaryList(values: string[], max = 2) {
  if (!values || values.length === 0) return null;
  const shown = values.slice(0, max).join(", ");
  const more = values.length - max;
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {more > 0 ? `${shown} +${more}` : shown}
    </span>
  );
}

function MultiChipSelector({
  options,
  selected,
  setSelected,
  allowNone = true,
  globalQuery,
}: {
  options: string[];
  selected: string[];
  setSelected: (v: string[]) => void;
  allowNone?: boolean;
  globalQuery?: string;
}) {
  const toggle = (opt: string) => {
    setSelected(
      selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt]
    );
  };
  const source = React.useMemo(
    () => (Array.isArray(options) ? options : []),
    [options]
  );
  const [localQuery, setLocalQuery] = React.useState("");
  const debouncedLocal = useDebouncedValue(localQuery, 250);
  const effectiveQuery = (debouncedLocal || globalQuery || "").toLowerCase();
  const filtered = effectiveQuery
    ? source.filter((o) => o.toLowerCase().includes(effectiveQuery))
    : source;
  return (
    <>
      <div className="px-4 pb-2">
        <Input
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search options"
          className="h-9"
        />
      </div>
      <div className="px-4 pb-4">
        <div className="flex flex-wrap justify-start gap-2">
          {filtered.map((opt) => (
            <Badge
              key={opt}
              role="button"
              onClick={() => toggle(opt)}
              className={`rounded-full cursor-pointer select-none ${
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {opt}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}

function MultiSelectPopover({
  title,
  options,
  selected,
  setSelected,
  globalQuery,
}: {
  title: string;
  options: string[];
  selected: string[];
  setSelected: (v: string[]) => void;
  globalQuery?: string;
}) {
  const toggle = (name: string) => {
    setSelected(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    );
  };
  const baseOptions = React.useMemo(() => {
    const src = Array.isArray(options) ? options : [];
    if (!globalQuery) return src;
    const q = globalQuery.toLowerCase();
    return src.filter((o) => o.toLowerCase().includes(q));
  }, [options, globalQuery]);
  return (
    <div className="px-4 pb-4 space-y-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {selected.length > 0 ? `${selected.length} selected` : title}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-(--radix-popover-trigger-width)"
          align="start"
        >
          <Command>
            <CommandInput placeholder={`Search ${title.toLowerCase()}...`} />
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {baseOptions.map((name) => {
                  const active = selected.includes(name);
                  return (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => toggle(name)}
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

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((n) => (
            <Badge
              key={n}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggle(n)}
              title="Remove"
            >
              {n}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntoPage() {
  // State
  const [attributes, setAttributes] = React.useState<string[]>([]);
  const [myType, setMyType] = React.useState<string[]>([]);
  const [fetishes, setFetishes] = React.useState<string[]>([]);
  const [actions, setActions] = React.useState<string[]>([]);
  const [scenarios, setScenarios] = React.useState<string[]>([]);
  const [topQuery, setTopQuery] = React.useState("");
  const debouncedTopQuery = useDebouncedValue(topQuery, 300);

  // Options
  const attributeOpts = safeArr(intoOptions.attributes);
  const myTypeOpts = safeArr(intoOptions.myType);
  const fetishOpts = safeArr(intoOptions.fetishes);
  const actionOpts = safeArr(intoOptions.actions);
  const scenarioOpts = safeArr(intoOptions.scenarios);

  const rows: {
    title: string;
    icon: React.ComponentType<any>;
    description: string;
    kind: "attributes" | "myType" | "fetishes" | "actions" | "scenarios";
  }[] = [
    {
      title: "Attributes",
      icon: Heart,
      description: "Traits and body notes",
      kind: "attributes",
    },
    {
      title: "My type",
      icon: Users,
      description: "Who you go for",
      kind: "myType",
    },
    {
      title: "Fetishes",
      icon: Sparkles,
      description: "Your interests",
      kind: "fetishes",
    },
    {
      title: "Action",
      icon: Clock,
      description: "Preferred play styles",
      kind: "actions",
    },
    {
      title: "Scenarios",
      icon: Shield,
      description: "Situations you enjoy",
      kind: "scenarios",
    },
  ];

  const summaryFor = (kind: (typeof rows)[number]["kind"]) => {
    switch (kind) {
      case "attributes":
        return SummaryList(attributes, 2);
      case "myType":
        return SummaryList(myType, 2);
      case "fetishes":
        return SummaryList(fetishes, 2);
      case "actions":
        return SummaryList(actions, 2);
      case "scenarios":
        return SummaryList(scenarios, 2);
    }
  };

  const countFor = (kind: (typeof rows)[number]["kind"]) => {
    switch (kind) {
      case "attributes":
        return attributes.length;
      case "myType":
        return myType.length;
      case "fetishes":
        return fetishes.length;
      case "actions":
        return actions.length;
      case "scenarios":
        return scenarios.length;
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar leftContent={<BackButton />}>
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          I’m into
        </h1>
      </TopBar>

      <div className="mt-2">
        <Input
          value={topQuery}
          onChange={(e) => setTopQuery(e.target.value)}
          placeholder="Search all options"
          className="h-10"
        />
      </div>

      <ItemGroup className="border-y border-border -mx-4 mt-4">
        {rows.map((row, i) => (
          <React.Fragment key={row.title}>
            <Drawer>
              <DrawerTrigger asChild>
                <Item className="px-4 py-3">
                  <ItemMedia variant="icon">
                    <row.icon className="h-4 w-4" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{row.title}</ItemTitle>
                    <ItemDescription>{row.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {(() => {
                      const n = countFor(row.kind);
                      return n > 0 ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {n} selected
                        </span>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      );
                    })()}
                  </ItemActions>
                </Item>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>{row.title}</DrawerTitle>
                </DrawerHeader>

                {row.kind === "attributes" ? (
                  <MultiSelectPopover
                    title="Select attributes"
                    options={attributeOpts}
                    selected={attributes}
                    setSelected={setAttributes}
                    globalQuery={debouncedTopQuery}
                  />
                ) : row.kind === "myType" ? (
                  <MultiSelectPopover
                    title="Select types"
                    options={myTypeOpts}
                    selected={myType}
                    setSelected={setMyType}
                    globalQuery={debouncedTopQuery}
                  />
                ) : row.kind === "fetishes" ? (
                  <MultiSelectPopover
                    title="Select fetishes"
                    options={fetishOpts}
                    selected={fetishes}
                    setSelected={setFetishes}
                    globalQuery={debouncedTopQuery}
                  />
                ) : row.kind === "actions" ? (
                  <MultiSelectPopover
                    title="Select actions"
                    options={actionOpts}
                    selected={actions}
                    setSelected={setActions}
                    globalQuery={debouncedTopQuery}
                  />
                ) : row.kind === "scenarios" ? (
                  <MultiSelectPopover
                    title="Select scenarios"
                    options={scenarioOpts}
                    selected={scenarios}
                    setSelected={setScenarios}
                    globalQuery={debouncedTopQuery}
                  />
                ) : null}
              </DrawerContent>
            </Drawer>
            {i !== rows.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}
