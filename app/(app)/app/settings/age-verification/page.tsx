"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { prepareImageFileForUpload } from "@/lib/images/prepareUpload";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Status = "idle" | "loading" | "error";
type Kind = "selfie" | "document_front" | "document_back";

function fmtDateForInput(date: Date | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(d: Date | undefined) {
  return !!d && !isNaN(d.getTime());
}

// Build YYYY-MM-DD without timezone shifting (uses local calendar date)
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse 'YYYY-MM-DD' coming from the DB into a local Date (no UTC shift)
function localDateFromISODateString(s: string | null | undefined) {
  if (!s) return undefined;
  const parts = s.split("-");
  if (parts.length !== 3) return undefined;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
  return new Date(y, m - 1, d);
}

export default function AgeVerificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any | null>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [busy, setBusy] = useState<Status>("idle");

  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [dobInput, setDobInput] = useState("");
  const [dobOpen, setDobOpen] = useState(false);
  const [dobMonth, setDobMonth] = useState<Date | undefined>(undefined);
  const [savingDob, setSavingDob] = useState<boolean>(false);

  const kinds: { key: Kind; label: string }[] = useMemo(
    () => [
      { key: "selfie", label: "Selfie (required)" },
      { key: "document_front", label: "Document (front)" },
      { key: "document_back", label: "Document (back)" },
    ],
    []
  );

  // Load or create a request immediately
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // 1) Load profile DOB
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("date_of_birth")
            .eq("id", user.id)
            .maybeSingle();
          if (prof?.date_of_birth) {
            const dt = localDateFromISODateString(prof.date_of_birth as string);
            if (isValidDate(dt)) {
              setDob(dt);
              setDobMonth(dt);
              setDobInput(fmtDateForInput(dt));
            }
          }
        }
        // 2) Load or create verification request (existing logic)
        const st = await fetch("/api/age-verification/status").then((r) =>
          r.json()
        );
        if (st?.request) {
          setRequest(st.request);
          setMedia(st.media || []);
        } else {
          const cr = await fetch("/api/age-verification/request", {
            method: "POST",
          }).then((r) => r.json());
          if (cr?.request) setRequest(cr.request);
        }
      } catch {
        toast.error("Failed to load verification status");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const onPick = async (kind: Kind, file: File | null) => {
    if (!file || !request) return;
    try {
      setBusy("loading");
      const processed = await prepareImageFileForUpload(file, 2048, 0.85); // client-optimize

      const up = await fetch("/api/age-verification/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ext: "webp" }),
      }).then((r) => r.json());

      if (!up?.uploadUrl || !up?.objectKey)
        throw new Error(up?.error || "Bad upload URL");

      await fetch(up.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type":
            (processed as Blob).type || "application/octet-stream",
        },
        body: processed as Blob,
      });

      const conf = await fetch("/api/age-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: up.requestId,
          kind,
          objectKey: up.objectKey,
        }),
      }).then((r) => r.json());

      if (conf?.error) throw new Error(conf.error);

      // reflect locally
      setMedia((prev) => {
        const without = prev.filter((m) => m.kind !== kind);
        return [...without, conf.media];
      });

      toast.success(`${kind.replace("_", " ")} uploaded`);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
      setBusy("error");
    } finally {
      setBusy("idle");
    }
  };

  const submit = async () => {
    if (!request) return;
    try {
      setBusy("loading");
      const res = await fetch("/api/age-verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id }),
      }).then((r) => r.json());
      if (res?.error) throw new Error(res.error);
      setRequest(res.request);
      toast.success("Submitted for review");
    } catch (e: any) {
      toast.error(e?.message || "Submit failed");
    } finally {
      setBusy("idle");
    }
  };

  const hasSelfie = media.some((m) => m.kind === "selfie");

  const saveDob = async () => {
    try {
      if (!dob || !isValidDate(dob)) {
        toast.error("Select a valid date of birth");
        return;
      }
      setSavingDob(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You’re not signed in.");
        setSavingDob(false);
        return;
      }
      // Store as ISO date (YYYY-MM-DD) to `profiles.date_of_birth`
      const iso = toISODateLocal(dob);
      const { error } = await supabase
        .from("profiles")
        .update({ date_of_birth: iso, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) {
        toast.error("Couldn’t save date of birth.");
      } else {
        toast.success("Date of birth saved");
      }
    } catch (e) {
      toast.error("Couldn’t save date of birth.");
    } finally {
      setSavingDob(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar leftContent={<BackButton />} rightContent={null}>
        <h1 className="px-1 pb-2 text-3xl font-extrabold tracking-tight">
          Age verification
        </h1>
      </TopBar>

      {loading ? (
        <p className="text-sm text-muted-foreground mt-2">Loading…</p>
      ) : (
        <div className="space-y-4 mt-3">
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="dob" className="px-1">
                Date of birth
              </Label>
              <div className="relative flex gap-2">
                <Input
                  id="dob"
                  value={dobInput}
                  placeholder="01 January 1990"
                  className="bg-background pr-10"
                  onChange={(e) => {
                    const parsed = new Date(e.target.value);
                    setDobInput(e.target.value);
                    if (isValidDate(parsed)) {
                      // Normalize to a local calendar date to avoid timezone shifts
                      const dt = new Date(
                        parsed.getFullYear(),
                        parsed.getMonth(),
                        parsed.getDate()
                      );
                      setDob(dt);
                      setDobMonth(dt);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setDobOpen(true);
                    }
                  }}
                />
                <Popover open={dobOpen} onOpenChange={setDobOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="dob-picker"
                      variant="ghost"
                      className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                    >
                      <CalendarIcon className="size-3.5" />
                      <span className="sr-only">Select date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="end"
                    alignOffset={-8}
                    sideOffset={10}
                  >
                    <Calendar
                      mode="single"
                      selected={dob}
                      captionLayout="dropdown"
                      month={dobMonth}
                      onMonthChange={setDobMonth}
                      onSelect={(picked) => {
                        const dt = picked
                          ? new Date(
                              picked.getFullYear(),
                              picked.getMonth(),
                              picked.getDate()
                            )
                          : undefined;
                        setDob(dt);
                        setDobInput(fmtDateForInput(dt));
                        setDobOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="pt-1">
                <Button
                  onClick={saveDob}
                  size="sm"
                  className="rounded-full"
                  disabled={savingDob}
                >
                  {savingDob ? "Saving…" : "Save date of birth"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm mb-3">
              Upload a selfie and (optionally) your ID. We’ll check you’re over
              18.
            </p>

            <div className="space-y-3">
              {kinds.map(({ key, label }) => {
                const present = media.find((m) => m.kind === key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm">{label}</p>
                      {present ? (
                        <p className="text-xs text-green-600">Added</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Not added
                        </p>
                      )}
                    </div>
                    <label className="inline-flex">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          onPick(key, e.target.files?.[0] || null)
                        }
                        disabled={busy === "loading"}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Upload</span>
                      </Button>
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Status:{" "}
                <span className="font-medium">
                  {request?.status || "created"}
                </span>
              </div>
              <Button
                size="sm"
                onClick={submit}
                disabled={!hasSelfie || busy === "loading"}
              >
                Submit for review
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
