"use client";

import * as React from "react";
import Link from "next/link";
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
  Shield,
  Syringe,
  Pill,
  HeartPulse,
  ChevronDown,
  ChevronRight,
  Check,
  ChevronsUpDown,
  BookOpen,
} from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  FieldGroup,
  FieldSet,
  FieldLabel,
  FieldDescription,
  Field,
  FieldContent,
  FieldTitle,
} from "@/components/ui/field";

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
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
  const [open, setOpen] = React.useState(false);

  const toggle = (name: string) => {
    setSelected(selected.includes(name) ? [] : [name]);
  };

  const baseOptions = React.useMemo(() => {
    const src = Array.isArray(options) ? options : [];
    if (!globalQuery) return src;
    const q = globalQuery.toLowerCase();
    return src.filter((o) => o.toLowerCase().includes(q));
  }, [options, globalQuery]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {selected.length === 0
              ? title
              : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
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
    </div>
  );
}

function summaryList(values: string[], max = 2) {
  if (!values || values.length === 0) return null;
  if (values.length === 1) return values[0];
  const shown = values.slice(0, max).join(", ");
  const more = values.length - max;
  return more > 0 ? `${shown} +${more}` : shown;
}

export default function SaferSexPage() {
  // State per section
  const [statusSel, setStatusSel] = React.useState<string[]>([]);
  const [hivSel, setHivSel] = React.useState<string | null>(null);
  const [hepCSel, setHepCSel] = React.useState<string | null>(null);
  const [hpvSel, setHpvSel] = React.useState<string | null>(null);
  const [vaxSel, setVaxSel] = React.useState<string[]>([]);
  const [prepPepSel, setPrepPepSel] = React.useState<string[]>([]);
  const [barrierSel, setBarrierSel] = React.useState<string | null>(null);

  // Options
  const hivStatusOpts = [
    "HIV- (Negative)",
    "HIV+ (Positive)",
    "HIV Undetectable (U=U)",
    "Unknown",
  ];
  const hepCStatusOpts = ["Hep C positive", "Hep C negative", "Unknown"];
  const hpvStatusOpts = ["HPV positive", "HPV negative", "Unknown"];
  const vaccineOpts = ["Mpox", "Gonorrhea", "HPV"];
  const prepPepOpts = ["PrEP", "DoxyPEP"];
  const barrierOpts = [
    "Bareback only",
    "Bareback with PrEP",
    "Sometimes bareback",
    "Condoms only",
    "Condoms sometimes",
  ];

  const rows: {
    title: string;
    icon: React.ComponentType<any>;
    description: string;
    kind: "status" | "vaccines" | "prepPep" | "barrier";
  }[] = [
    {
      title: "Status",
      icon: Shield,
      description: "Your current statuses",
      kind: "status",
    },
    {
      title: "Vaccines",
      icon: Syringe,
      description: "What you’ve had",
      kind: "vaccines",
    },
    {
      title: "PrEP & PEP",
      icon: Pill,
      description: "Prevention meds",
      kind: "prepPep",
    },
    {
      title: "Bareback & Condoms",
      icon: HeartPulse,
      description: "Your practice",
      kind: "barrier",
    },
  ];

  const statusSummary = () => {
    const parts = [hivSel, hepCSel, hpvSel].filter(Boolean) as string[];
    return summaryList(parts, 2);
  };

  const vaccinesSummary = () => summaryList(vaxSel, 2);
  const prepPepSummary = () => summaryList(prepPepSel, 2);
  const barrierSummary = () => (barrierSel ? barrierSel : null);

  const summaryFor = (kind: (typeof rows)[number]["kind"]) => {
    switch (kind) {
      case "status":
        return statusSummary();
      case "vaccines":
        return vaccinesSummary();
      case "prepPep":
        return prepPepSummary();
      case "barrier":
        return barrierSummary();
    }
  };

  const countFor = (kind: (typeof rows)[number]["kind"]) => {
    switch (kind) {
      case "status":
        return (hivSel ? 1 : 0) + (hepCSel ? 1 : 0) + (hpvSel ? 1 : 0);
      case "vaccines":
        return vaxSel.length;
      case "prepPep":
        return prepPepSel.length;
      case "barrier":
        return barrierSel ? 1 : 0;
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar leftContent={<BackButton />}>
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Safer sex
        </h1>
      </TopBar>

      <div className="mt-2">
        <Link href="/app/settings/safer-sex/guide" className="block">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5" />
              <div className="flex-1">
                <div className="font-semibold">Safer sex guide</div>
                <div className="text-sm text-muted-foreground">
                  Where to get PrEP, DoxyPEP, free condoms, and STI testing.
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
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
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </DrawerTrigger>
              <DrawerContent className="p-0 flex max-h-[80vh] flex-col">
                <DrawerHeader className="z-20 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 relative">
                  <DrawerTitle>{row.title}</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                  {row.kind === "status" ? (
                    <div className="px-4 pb-4 space-y-8">
                      {/* HIV Status */}
                      <FieldGroup>
                        <FieldSet>
                          <FieldLabel htmlFor="rg-hiv">HIV status</FieldLabel>
                          <FieldDescription>
                            Select your HIV status.
                          </FieldDescription>
                          <RadioGroup
                            id="rg-hiv"
                            value={hivSel ?? ""}
                            onValueChange={(v) => setHivSel(v || null)}
                          >
                            {hivStatusOpts.map((opt) => {
                              const id = `hiv-${opt}`;
                              return (
                                <FieldLabel key={opt} htmlFor={id}>
                                  <Field orientation="horizontal">
                                    <FieldContent>
                                      <FieldTitle>{opt}</FieldTitle>
                                    </FieldContent>
                                    <RadioGroupItem value={opt} id={id} />
                                  </Field>
                                </FieldLabel>
                              );
                            })}
                          </RadioGroup>
                        </FieldSet>
                      </FieldGroup>

                      {/* Hep C Status */}
                      <FieldGroup>
                        <FieldSet>
                          <FieldLabel htmlFor="rg-hepc">
                            Hep C status
                          </FieldLabel>
                          <FieldDescription>
                            Select your Hep C status.
                          </FieldDescription>
                          <RadioGroup
                            id="rg-hepc"
                            value={hepCSel ?? ""}
                            onValueChange={(v) => setHepCSel(v || null)}
                          >
                            {hepCStatusOpts.map((opt) => {
                              const id = `hepc-${opt}`;
                              return (
                                <FieldLabel key={opt} htmlFor={id}>
                                  <Field orientation="horizontal">
                                    <FieldContent>
                                      <FieldTitle>{opt}</FieldTitle>
                                    </FieldContent>
                                    <RadioGroupItem value={opt} id={id} />
                                  </Field>
                                </FieldLabel>
                              );
                            })}
                          </RadioGroup>
                        </FieldSet>
                      </FieldGroup>

                      {/* HPV Status */}
                      <FieldGroup>
                        <FieldSet>
                          <FieldLabel htmlFor="rg-hpv">HPV status</FieldLabel>
                          <FieldDescription>
                            Select your HPV status.
                          </FieldDescription>
                          <RadioGroup
                            id="rg-hpv"
                            value={hpvSel ?? ""}
                            onValueChange={(v) => setHpvSel(v || null)}
                          >
                            {hpvStatusOpts.map((opt) => {
                              const id = `hpv-${opt}`;
                              return (
                                <FieldLabel key={opt} htmlFor={id}>
                                  <Field orientation="horizontal">
                                    <FieldContent>
                                      <FieldTitle>{opt}</FieldTitle>
                                    </FieldContent>
                                    <RadioGroupItem value={opt} id={id} />
                                  </Field>
                                </FieldLabel>
                              );
                            })}
                          </RadioGroup>
                        </FieldSet>
                      </FieldGroup>
                    </div>
                  ) : row.kind === "vaccines" ? (
                    <div className="px-4 pb-4 space-y-2">
                      {vaccineOpts.map((opt) => {
                        const checked = vaxSel.includes(opt);
                        const id = `vax-${opt}`;
                        return (
                          <div
                            key={opt}
                            className="flex items-center space-x-2 py-1.5"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(c) => {
                                const on = Boolean(c);
                                setVaxSel(
                                  on
                                    ? [...vaxSel, opt]
                                    : vaxSel.filter((v) => v !== opt)
                                );
                              }}
                            />
                            <Label htmlFor={id} className="text-sm">
                              {opt}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  ) : row.kind === "prepPep" ? (
                    <div className="px-4 pb-4 space-y-3">
                      {prepPepOpts.map((opt) => {
                        const checked = prepPepSel.includes(opt);
                        const id = `prep-${opt}`;
                        return (
                          <Label
                            key={opt}
                            htmlFor={id}
                            className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(c) => {
                                const on = Boolean(c);
                                setPrepPepSel(
                                  on
                                    ? [...prepPepSel, opt]
                                    : prepPepSel.filter((v) => v !== opt)
                                );
                              }}
                              className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                            />
                            <div className="grid gap-1.5 font-normal">
                              <p className="text-sm leading-none font-medium">
                                {opt}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {opt === "PrEP"
                                  ? "Taken to prevent HIV infection."
                                  : "An antibiotic used after sex to prevent STIs."}
                              </p>
                            </div>
                          </Label>
                        );
                      })}
                    </div>
                  ) : row.kind === "barrier" ? (
                    <div className="px-4 pb-4">
                      <FieldGroup>
                        <FieldSet>
                          <FieldLabel htmlFor="rg-barrier">
                            Bareback & Condoms
                          </FieldLabel>
                          <FieldDescription>
                            Select your usual practice.
                          </FieldDescription>
                          <RadioGroup
                            id="rg-barrier"
                            value={barrierSel ?? ""}
                            onValueChange={(v) => setBarrierSel(v || null)}
                          >
                            {barrierOpts.map((opt) => {
                              const id = `barrier-${opt}`;
                              return (
                                <FieldLabel key={opt} htmlFor={id}>
                                  <Field orientation="horizontal">
                                    <FieldContent>
                                      <FieldTitle>{opt}</FieldTitle>
                                    </FieldContent>
                                    <RadioGroupItem value={opt} id={id} />
                                  </Field>
                                </FieldLabel>
                              );
                            })}
                          </RadioGroup>
                        </FieldSet>
                      </FieldGroup>
                    </div>
                  ) : null}
                </div>
              </DrawerContent>
            </Drawer>
            {i !== rows.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}
