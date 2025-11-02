"use client";

import * as React from "react";
import Link from "next/link";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { createClient } from "@/utils/supabase/client";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

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
  const [hivSel, setHivSel] = React.useState<string | null>(null);
  const [hepCSel, setHepCSel] = React.useState<string | null>(null);
  const [hpvSel, setHpvSel] = React.useState<string | null>(null);
  const [vaxSel, setVaxSel] = React.useState<string[]>([]);
  const [prepPepSel, setPrepPepSel] = React.useState<string[]>([]);
  const [barrierSel, setBarrierSel] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        console.warn("[safer-sex] no authenticated user, skipping fetch");
        return;
      }
      setCurrentUserId(user.id);

      // try to get existing safer-sex row
      const { data, error } = await supabase
        .from("safer_sex")
        .select(
          "hiv_status, hep_c_status, hpv_status, vaccines, prep_pep, barrier_practice"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setHivSel(data.hiv_status);
        setHepCSel(data.hep_c_status);
        setHpvSel(data.hpv_status);
        setVaxSel(Array.isArray(data.vaccines) ? data.vaccines : []);
        setPrepPepSel(Array.isArray(data.prep_pep) ? data.prep_pep : []);
        setBarrierSel(data.barrier_practice);
      } else if (error) {
        console.error("[safer-sex] fetch failed:", error);
      }

      setLoading(false);
    };
    load();
  }, []);

  // Options
  const saveToSupabase = React.useCallback(
    async (next: {
      hiv_status?: string | null;
      hep_c_status?: string | null;
      hpv_status?: string | null;
      vaccines?: string[];
      prep_pep?: string[];
      barrier_practice?: string | null;
    }) => {
      if (!currentUserId) {
        console.warn("[safer-sex] tried to save but no user id yet");
        return;
      }
      setSaving(true);
      const supabase = createClient();
      const { error } = await supabase.from("safer_sex").upsert({
        user_id: currentUserId,
        hiv_status: next.hiv_status ?? hivSel,
        hep_c_status: next.hep_c_status ?? hepCSel,
        hpv_status: next.hpv_status ?? hpvSel,
        vaccines: next.vaccines ?? vaxSel,
        prep_pep: next.prep_pep ?? prepPepSel,
        barrier_practice: next.barrier_practice ?? barrierSel,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error("[safer-sex] upsert failed:", error);
      } else {
        console.info("[safer-sex] upsert ok");
      }
      setSaving(false);
    },
    [currentUserId, hivSel, hepCSel, hpvSel, vaxSel, prepPepSel, barrierSel]
  );
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
          <div className="rounded-xl bg-card p-4">
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

      {saving ? (
        <p className="mt-3 text-xs text-muted-foreground">Saving&hellip;</p>
      ) : null}

      {loading ? (
        <ItemGroup className="border-y border-border -mx-4 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-44 bg-muted/80 rounded animate-pulse" />
                </div>
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
              </div>
              {i !== 4 && <ItemSeparator />}
            </React.Fragment>
          ))}
        </ItemGroup>
      ) : (
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
                    {/* keep all existing row.kind === ... blocks exactly as they are */}
                    {row.kind === "status" ? (
                      <div className="px-4 pb-4 space-y-4">
                        {/* HIV Status */}
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              HIV status
                            </CardTitle>
                            <CardDescription>
                              Select your HIV status.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2">
                            <FieldGroup>
                              <FieldSet>
                                <RadioGroup
                                  id="rg-hiv"
                                  value={hivSel ?? ""}
                                  onValueChange={(v) => {
                                    const val = v || null;
                                    setHivSel(val);
                                    saveToSupabase({ hiv_status: val });
                                  }}
                                >
                                  {hivStatusOpts.map((opt) => {
                                    const id = `hiv-${opt}`;
                                    let desc = "";
                                    if (opt === "HIV+ (Positive)")
                                      desc =
                                        "Your most recent test returned positive.";
                                    else if (opt === "HIV- (Negative)")
                                      desc =
                                        "Your most recent test returned negative.";
                                    else if (opt === "HIV Undetectable (U=U)")
                                      desc = "Undetectable = Untransmissable.";
                                    // Unknown stays blank
                                    return (
                                      <FieldLabel key={opt} htmlFor={id}>
                                        <Field orientation="horizontal">
                                          <FieldContent>
                                            <FieldTitle>{opt}</FieldTitle>
                                            {desc && (
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                {desc}
                                              </p>
                                            )}
                                          </FieldContent>
                                          <RadioGroupItem value={opt} id={id} />
                                        </Field>
                                      </FieldLabel>
                                    );
                                  })}
                                </RadioGroup>
                              </FieldSet>
                            </FieldGroup>
                          </CardContent>
                        </Card>

                        {/* Hep C Status */}
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              Hep C status
                            </CardTitle>
                            <CardDescription>
                              Select your Hep C status.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2">
                            <FieldGroup>
                              <FieldSet>
                                <RadioGroup
                                  id="rg-hepc"
                                  value={hepCSel ?? ""}
                                  onValueChange={(v) => {
                                    const val = v || null;
                                    setHepCSel(val);
                                    saveToSupabase({ hep_c_status: val });
                                  }}
                                >
                                  {hepCStatusOpts.map((opt) => {
                                    const id = `hepc-${opt}`;
                                    let desc = "";
                                    if (opt === "Hep C positive")
                                      desc =
                                        "Your most recent test returned positive.";
                                    else if (opt === "Hep C negative")
                                      desc =
                                        "Your most recent test returned negative.";
                                    // Unknown stays blank
                                    return (
                                      <FieldLabel key={opt} htmlFor={id}>
                                        <Field orientation="horizontal">
                                          <FieldContent>
                                            <FieldTitle>{opt}</FieldTitle>
                                            {desc && (
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                {desc}
                                              </p>
                                            )}
                                          </FieldContent>
                                          <RadioGroupItem value={opt} id={id} />
                                        </Field>
                                      </FieldLabel>
                                    );
                                  })}
                                </RadioGroup>
                              </FieldSet>
                            </FieldGroup>
                          </CardContent>
                        </Card>

                        {/* HPV Status */}
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              HPV status
                            </CardTitle>
                            <CardDescription>
                              Select your HPV status.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2">
                            <FieldGroup>
                              <FieldSet>
                                <RadioGroup
                                  id="rg-hpv"
                                  value={hpvSel ?? ""}
                                  onValueChange={(v) => {
                                    const val = v || null;
                                    setHpvSel(val);
                                    saveToSupabase({ hpv_status: val });
                                  }}
                                >
                                  {hpvStatusOpts.map((opt) => {
                                    const id = `hpv-${opt}`;
                                    let desc = "";
                                    if (opt === "HPV positive")
                                      desc =
                                        "Your most recent test returned positive.";
                                    else if (opt === "HPV negative")
                                      desc =
                                        "Your most recent test returned negative.";
                                    // Unknown stays blank
                                    return (
                                      <FieldLabel key={opt} htmlFor={id}>
                                        <Field orientation="horizontal">
                                          <FieldContent>
                                            <FieldTitle>{opt}</FieldTitle>
                                            {desc && (
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                {desc}
                                              </p>
                                            )}
                                          </FieldContent>
                                          <RadioGroupItem value={opt} id={id} />
                                        </Field>
                                      </FieldLabel>
                                    );
                                  })}
                                </RadioGroup>
                              </FieldSet>
                            </FieldGroup>
                          </CardContent>
                        </Card>
                      </div>
                    ) : row.kind === "vaccines" ? (
                      <div className="px-4 pb-4">
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              Vaccines
                            </CardTitle>
                            <CardDescription>What you’ve had.</CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2 space-y-3">
                            {vaccineOpts.map((opt) => {
                              const checked = vaxSel.includes(opt);
                              const id = `vax-${opt}`;
                              let desc = "";
                              if (opt === "Mpox") {
                                desc = "Reduce risk of Mpox infection.";
                              } else if (opt === "Gonorrhea") {
                                desc = "Reduce risk of gonorrhea infection.";
                              } else if (opt === "HPV") {
                                desc = "Reduce risk of HPV infection.";
                              }
                              return (
                                <Label
                                  key={opt}
                                  htmlFor={id}
                                  className="hover:bg-accent/50 flex items-start gap-3 rounded-lg p-3 has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950"
                                >
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const on = Boolean(c);
                                      const next = on
                                        ? [...vaxSel, opt]
                                        : vaxSel.filter((v) => v !== opt);
                                      setVaxSel(next);
                                      saveToSupabase({ vaccines: next });
                                    }}
                                    className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                  />
                                  <div className="grid gap-1.5 font-normal">
                                    <p className="text-sm leading-none font-medium">
                                      {opt}
                                    </p>
                                    {desc ? (
                                      <p className="text-muted-foreground text-sm">
                                        {desc}
                                      </p>
                                    ) : null}
                                  </div>
                                </Label>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </div>
                    ) : row.kind === "prepPep" ? (
                      <div className="px-4 pb-4">
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              PrEP & PEP
                            </CardTitle>
                            <CardDescription>
                              Prevention meds, on-demand or daily.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2 space-y-3">
                            {prepPepOpts.map((opt) => {
                              const checked = prepPepSel.includes(opt);
                              const id = `prep-${opt}`;
                              return (
                                <Label
                                  key={opt}
                                  htmlFor={id}
                                  className="hover:bg-accent/50 flex items-start gap-3 rounded-lg p-3 has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950"
                                >
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const on = Boolean(c);
                                      const next = on
                                        ? [...prepPepSel, opt]
                                        : prepPepSel.filter((v) => v !== opt);
                                      setPrepPepSel(next);
                                      saveToSupabase({ prep_pep: next });
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
                                        : "Antibiotic after sex to prevent STIs."}
                                    </p>
                                  </div>
                                </Label>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </div>
                    ) : row.kind === "barrier" ? (
                      <div className="px-4 pb-4">
                        <Card className="bg-card/60 backdrop-blur-sm border-0">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-base">
                              Bareback & condoms
                            </CardTitle>
                            <CardDescription>
                              Select your usual practice.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-1 pb-2">
                            <FieldGroup>
                              <FieldSet>
                                <RadioGroup
                                  id="rg-barrier"
                                  value={barrierSel ?? ""}
                                  onValueChange={(v) => {
                                    const val = v || null;
                                    setBarrierSel(val);
                                    saveToSupabase({ barrier_practice: val });
                                  }}
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
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}
                  </div>
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
