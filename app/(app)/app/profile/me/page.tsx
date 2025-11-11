"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import getAvatarPublicUrl from "@/lib/profiles/getAvatarProxyUrl";

// ---------- Types ----------
interface Profile {
  id: string;
  name: string | null;
  username: string | null;
  profile_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  nationalities: string[] | null;
  languages: string[] | null; // UUIDs referencing languages

  ethnicity_id: string | null;
  body_type_id: string | null;
  position_id: string | null;
  attitude_id: string | null;
  sexuality_id: string | null;
  dick_size_id: string | null;
  dick_girth_id: string | null;
  dick_cut_status_id: string | null;

  height_cm: string | number | null;
  weight_kg: string | number | null;
  height_input_unit: string | null;
  weight_input_unit: string | null;

  dick_length_cm: string | number | null;
  dick_length_input_unit: string | null;
  dick_size_label: string | null;
  dick_cut: string | null; // raw field
  dick_show: boolean | null;
}

const pickLabel = (row: any) =>
  row?.label ?? row?.name ?? row?.title ?? row?.value ?? null;

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [lookups, setLookups] = useState<{
    ethnicity?: string | null;
    body_type?: string | null;
    position?: string | null;
    attitude?: string | null;
    sexuality?: string | null;
    dick_size?: string | null;
    dick_girth?: string | null;
    dick_cut_status?: string | null;
    languages?: string[];
  }>({});

  // --------- Load base profile for current user ---------
  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          setError("Not signed in");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            [
              "id",
              "name",
              "username",
              "profile_title",
              "bio",
              "avatar_url",
              "updated_at",
              "nationalities",
              "languages",
              "ethnicity_id",
              "body_type_id",
              "position_id",
              "attitude_id",
              "sexuality_id",
              "dick_size_id",
              "dick_girth_id",
              "dick_cut_status_id",
              "height_cm",
              "weight_kg",
              "height_input_unit",
              "weight_input_unit",
              "dick_length_cm",
              "dick_length_input_unit",
              "dick_size_label",
              "dick_cut",
              "dick_show",
            ].join(",")
          )
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setError("Profile not found");
          setProfile(null);
        } else {
          setProfile(data as unknown as Profile);
          setError(null);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // --------- Resolve lookups ---------
  useEffect(() => {
    const loadLookups = async () => {
      if (!profile) return;
      const supabase = createClient();

      const next: any = {};
      const fetchSingle = async (
        table: string,
        id: string | null,
        key: string
      ) => {
        if (!id) return;
        const { data, error } = await supabase
          .from(table)
          .select("id, name, label, title, value")
          .eq("id", id)
          .maybeSingle();
        if (!error && data) next[key] = pickLabel(data);
      };

      await Promise.all([
        fetchSingle("ethnicities", profile.ethnicity_id, "ethnicity"),
        fetchSingle("body_types", profile.body_type_id, "body_type"),
        fetchSingle("positions", profile.position_id, "position"),
        fetchSingle("attitudes", profile.attitude_id, "attitude"),
        fetchSingle("sexualities", profile.sexuality_id, "sexuality"),
        fetchSingle("dick_sizes", profile.dick_size_id, "dick_size"),
        fetchSingle("dick_girths", profile.dick_girth_id, "dick_girth"),
        fetchSingle(
          "dick_cut_statuses",
          profile.dick_cut_status_id,
          "dick_cut_status"
        ),
      ]);

      if (Array.isArray(profile.languages) && profile.languages.length) {
        const { data, error } = await supabase
          .from("languages")
          .select("id, name, label")
          .in("id", profile.languages as string[]);
        if (!error && data)
          next.languages = (data as any[]).map(pickLabel).filter(Boolean);
      }

      setLookups(next);
    };
    loadLookups();
  }, [profile]);

  // --------- Derived display ---------
  const avatarUrl = useMemo(
    () => getAvatarPublicUrl(profile?.avatar_url) ?? "/avatar-fallback.png",
    [profile?.avatar_url]
  );

  const heightDisplay = useMemo(() => {
    if (!profile?.height_cm) return null;
    const val = String(profile.height_cm);
    const unit = profile.height_input_unit || "cm";
    return `${val}${unit}`;
  }, [profile?.height_cm, profile?.height_input_unit]);

  const weightDisplay = useMemo(() => {
    if (!profile?.weight_kg) return null;
    const val = String(profile.weight_kg);
    const unit = profile.weight_input_unit || "kg";
    return `${val}${unit}`;
  }, [profile?.weight_kg, profile?.weight_input_unit]);

  const dickDisplay = useMemo(() => {
    if (!profile) return null;
    const showActual = !!profile.dick_show && profile.dick_length_cm;
    if (showActual) {
      const val = String(profile.dick_length_cm);
      const unit = profile.dick_length_input_unit || "cm";
      return `${val}${unit}`;
    }
    return profile.dick_size_label || lookups.dick_size || null;
  }, [profile, lookups.dick_size]);

  const updatedDisplay = useMemo(() => {
    if (!profile?.updated_at) return null;
    try {
      const d = new Date(profile.updated_at);
      return d.toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      });
    } catch {
      return profile.updated_at;
    }
  }, [profile?.updated_at]);

  const dickCutDisplay = useMemo(() => {
    if (lookups.dick_cut_status) return lookups.dick_cut_status;
    if (profile?.dick_cut == null) return null;
    const val = String(profile.dick_cut).toLowerCase();
    if (val === "true" || val === "yes" || val === "cut") return "Cut";
    if (val === "false" || val === "no" || val === "uncut") return "Uncut";
    return profile?.dick_cut;
  }, [lookups.dick_cut_status, profile?.dick_cut]);

  return (
    <div className="bg-background">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 border-b px-4 py-3 flex items-center gap-3">
        <Link
          href="/app/messages"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back
        </Link>
        <h1 className="text-sm font-semibold">My profile</h1>
      </header>

      <main className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 w-40">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">Profile unavailable.</p>
        ) : (
          <>
            {/* Header */}
            <section className="flex items-start gap-4">
              <img
                src={avatarUrl}
                alt={profile.profile_title || profile.username || "Avatar"}
                className="h-16 w-16 rounded-full border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/avatar-fallback.png";
                }}
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">
                  {profile.profile_title ||
                    profile.name ||
                    profile.username ||
                    "User"}
                </h2>
                {profile.username ? (
                  <p className="text-sm text-muted-foreground truncate">
                    @{profile.username}
                  </p>
                ) : null}
                {updatedDisplay ? (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    Updated {updatedDisplay}
                  </p>
                ) : null}
              </div>
            </section>

            {/* About */}
            {profile.bio ? (
              <>
                <Separator />
                <section>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    About
                  </h3>
                  <p className="text-sm whitespace-pre-wrap wrap-break-word">
                    {profile.bio}
                  </p>
                </section>
              </>
            ) : null}

            {/* Details */}
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  {heightDisplay ? (
                    <div>
                      <span className="text-muted-foreground">Height</span>
                      <br />
                      {heightDisplay}
                    </div>
                  ) : null}
                  {weightDisplay ? (
                    <div>
                      <span className="text-muted-foreground">Weight</span>
                      <br />
                      {weightDisplay}
                    </div>
                  ) : null}
                  {lookups.ethnicity ? (
                    <div>
                      <span className="text-muted-foreground">Ethnicity</span>
                      <br />
                      {lookups.ethnicity}
                    </div>
                  ) : null}
                  {lookups.body_type ? (
                    <div>
                      <span className="text-muted-foreground">Body type</span>
                      <br />
                      {lookups.body_type}
                    </div>
                  ) : null}
                  {lookups.position ? (
                    <div>
                      <span className="text-muted-foreground">Position</span>
                      <br />
                      {lookups.position}
                    </div>
                  ) : null}
                  {lookups.sexuality ? (
                    <div>
                      <span className="text-muted-foreground">Sexuality</span>
                      <br />
                      {lookups.sexuality}
                    </div>
                  ) : null}
                  {lookups.attitude ? (
                    <div>
                      <span className="text-muted-foreground">Attitude</span>
                      <br />
                      {lookups.attitude}
                    </div>
                  ) : null}
                  {dickDisplay ? (
                    <div>
                      <span className="text-muted-foreground">Dick</span>
                      <br />
                      {dickDisplay}
                    </div>
                  ) : null}
                  {lookups.dick_girth ? (
                    <div>
                      <span className="text-muted-foreground">Girth</span>
                      <br />
                      {lookups.dick_girth}
                    </div>
                  ) : null}
                  {dickCutDisplay ? (
                    <div>
                      <span className="text-muted-foreground">Cut status</span>
                      <br />
                      {dickCutDisplay}
                    </div>
                  ) : null}
                </div>
              </section>
            </>

            {/* Languages & Nationalities */}
            {(lookups.languages && lookups.languages.length) ||
            (profile.nationalities && profile.nationalities.length) ? (
              <>
                <Separator />
                <section className="space-y-3">
                  {lookups.languages && lookups.languages.length ? (
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Languages
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {lookups.languages.map((lng, i) => (
                          <span
                            key={`lng-${i}`}
                            className="px-2 py-0.5 rounded-full border text-xs"
                          >
                            {lng}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {profile.nationalities && profile.nationalities.length ? (
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Nationalities
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.nationalities.map((nat, i) => (
                          <span
                            key={`nat-${i}`}
                            className="px-2 py-0.5 rounded-full border text-xs"
                          >
                            {nat}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {/* Actions */}
            <section className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/messages?id=${profile.id}`}>Message</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="#">Connect</Link>
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
