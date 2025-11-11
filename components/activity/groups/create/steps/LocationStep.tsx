"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateGroup } from "@/lib/groups/client";
import { z } from "zod";
import React from "react";
import { createClient } from "@/utils/supabase/client";

const locationFormSchema = z.object({
  location_text: z.string().trim().optional().nullable(),
  postcode: z.string().trim().optional().nullable(),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
});

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { MapPin, Loader2 } from "lucide-react";

type FormData = z.infer<typeof locationFormSchema>;

type GeoResult = { lat: number; lng: number } | null;

async function geocodeQuery(query: string): Promise<GeoResult> {
  try {
    if (!query || !query.trim()) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: {
        // polite UA per Nominatim policy
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data: any[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    const lat = parseFloat(top.lat);
    const lng = parseFloat(top.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

export default function LocationStep({
  groupId,
  onNext,
  onBack,
}: {
  groupId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      location_text: undefined,
      postcode: undefined,
      location_lat: undefined,
      location_lng: undefined,
    },
  });

  const [showOnMap, setShowOnMap] = React.useState(true);
  const [hideOnListing, setHideOnListing] = React.useState(true);
  const [showOnDay, setShowOnDay] = React.useState(false);

  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("groups")
          .select(
            "location_text,postcode,display_on_map,hide_address_on_listing,display_address_on_day,location_lat,location_lng"
          )
          .eq("id", groupId)
          .maybeSingle();
        if (error || !data || !active) return;

        form.reset({
          location_text: data.location_text ?? "",
          postcode: data.postcode ?? "",
          location_lat: (data.location_lat ?? undefined) as number | undefined,
          location_lng: (data.location_lng ?? undefined) as number | undefined,
        });
        setShowOnMap(Boolean(data.display_on_map ?? true));
        // Default to true if DB value is null/undefined, otherwise respect stored boolean
        setHideOnListing(data.hide_address_on_listing ?? true);
        // Default to false if DB value is null/undefined, otherwise respect stored boolean
        setShowOnDay(data.display_address_on_day ?? false);
        setGeoError(null);
      } catch (e) {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  const onSubmit = async (data: FormData) => {
    console.log("LocationStep submit", data);
    const cleaned = {
      ...data,
      location_text: data.location_text ?? null,
      postcode: data.postcode ?? null,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      display_on_map: showOnMap,
      hide_address_on_listing: hideOnListing,
      display_address_on_day: hideOnListing ? showOnDay : true,
    };
    // Fire-and-forget to avoid locking the submit state if the request hangs
    updateGroup(groupId, cleaned).catch((err) => {
      console.error("Failed to update group location:", err);
    });
    onNext();
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4 px-1">Location</h1>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3"
        >
          {/* Address + Postcode container */}
          <div className="rounded-lg bg-card p-4 shadow-sm space-y-4">
            <FormField
              control={form.control}
              name="location_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupTextarea
                        placeholder="Street address, city"
                        value={(field.value as string | undefined) ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v.trim().length === 0 ? undefined : v);
                        }}
                        onBlur={(e) => {
                          const v = e.target.value;
                          field.onChange(
                            v.trim().length === 0 ? undefined : v.trim()
                          );
                        }}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="flex-1 p-0">
                          <input
                            {...form.register("postcode", {
                              setValueAs: (v) =>
                                typeof v === "string" && v.trim().length === 0
                                  ? undefined
                                  : v,
                            })}
                            autoComplete="postal-code"
                            inputMode="text"
                            placeholder="Postcode"
                            className="w-full bg-transparent text-base md:text-sm leading-none outline-none border-0 m-0 py-1.5 focus-visible:ring-0"
                            aria-label="Postcode"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                          />
                        </InputGroupText>
                        <InputGroupButton
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-md"
                          disabled={isGeocoding}
                          onClick={async () => {
                            setGeoError(null);
                            setIsGeocoding(true);
                            try {
                              const addr =
                                form.getValues("location_text") || "";
                              const pc = form.getValues("postcode") || "";
                              const q = [addr, pc].filter(Boolean).join(", ");
                              const result = await geocodeQuery(
                                q || pc || addr
                              );
                              if (!result) {
                                setGeoError("Couldn’t find that location");
                                return;
                              }
                              // Update form and persist
                              form.setValue(
                                "location_lat",
                                result.lat as number,
                                {
                                  shouldDirty: true,
                                }
                              );
                              form.setValue(
                                "location_lng",
                                result.lng as number,
                                {
                                  shouldDirty: true,
                                }
                              );

                              await updateGroup(groupId, {
                                location_lat: result.lat,
                                location_lng: result.lng,
                              });
                            } finally {
                              setIsGeocoding(false);
                            }
                          }}
                        >
                          {isGeocoding ? (
                            <>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              Looking up
                            </>
                          ) : (
                            <>Lookup on map</>
                          )}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Map placeholder */}
          <div className="rounded-lg bg-card overflow-hidden shadow-sm">
            <div
              className="relative w-full flex items-center justify-center text-sm bg-muted"
              style={{ minHeight: "16rem", height: "16rem" }}
            >
              {isGeocoding ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Looking up location…</span>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {(() => {
                        const lat = form.getValues("location_lat");
                        const lng = form.getValues("location_lng");
                        return typeof lat === "number" &&
                          typeof lng === "number"
                          ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                          : "No coordinates";
                      })()}
                    </span>
                  </div>
                  {geoError ? (
                    <div className="text-destructive text-xs">{geoError}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    Map preview coming soon
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="switch-show-on-map">
                Display location on the map
              </Label>
              <Switch
                id="switch-show-on-map"
                checked={showOnMap}
                onCheckedChange={async (checked) => {
                  setShowOnMap(checked);
                  try {
                    await updateGroup(groupId, { display_on_map: checked });
                  } catch (e) {
                    console.error("Failed to update display_on_map", e);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="switch-hide-on-listing">
                Hide address/postcode on the listing
              </Label>
              <Switch
                id="switch-hide-on-listing"
                checked={hideOnListing}
                onCheckedChange={async (checked) => {
                  setHideOnListing(checked);
                  try {
                    const payload: {
                      hide_address_on_listing: boolean;
                      display_address_on_day?: boolean;
                    } = {
                      hide_address_on_listing: checked,
                    };
                    if (!checked) {
                      // If not hidden on listing, force show on day = true
                      payload.display_address_on_day = true;
                      setShowOnDay(true);
                    }
                    await updateGroup(groupId, payload);
                  } catch (e) {
                    console.error("Failed to update hide/display settings", e);
                  }
                }}
              />
            </div>

            {hideOnListing ? (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="switch-show-on-day">
                  Display address/postcode on the day
                </Label>
                <Switch
                  id="switch-show-on-day"
                  checked={showOnDay}
                  onCheckedChange={async (checked) => {
                    setShowOnDay(checked);
                    try {
                      if (hideOnListing) {
                        await updateGroup(groupId, {
                          display_address_on_day: checked,
                        });
                      }
                    } catch (e) {
                      console.error(
                        "Failed to update display_address_on_day",
                        e
                      );
                    }
                  }}
                />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Only confirmed attendees will see address/postcode.
            </p>
          </div>

          <div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-md"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Continue
                </>
              ) : (
                <>Continue</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
