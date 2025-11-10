"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { ChevronDownIcon, Loader2, ArrowRight } from "lucide-react";

import { useForm } from "react-hook-form";
import { updateGroup } from "@/app/api/groups/actions";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

type FormData = {
  start_time_text: string;
  end_time_text: string;
};

function fmt(date?: Date) {
  if (!date) return "Pick a date";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function hhmm(d: Date) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function ScheduleStep({
  groupId,
  onNext,
  onBack,
}: {
  groupId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const form = useForm<FormData>({
    defaultValues: {
      start_time_text: "10:30",
      end_time_text: "11:30",
    },
  });

  // Window: today -> +3 months (local)
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = React.useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 3);
    return d;
  }, [today]);

  // Hydrate from Supabase on mount and when groupId changes
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("groups")
          .select("start_time,end_time")
          .eq("id", groupId)
          .maybeSingle();
        if (error || !data || !active) return;

        if (data.start_time) {
          const s = new Date(data.start_time);
          setDateFrom(s);
          form.setValue("start_time_text", hhmm(s), { shouldDirty: false });
        }
        if (data.end_time) {
          const e = new Date(data.end_time);
          setDateTo(e);
          form.setValue("end_time_text", hhmm(e), { shouldDirty: false });
          setNoEndTime(false);
        } else {
          setDateTo(undefined);
          form.setValue("end_time_text", "", { shouldDirty: false });
          setNoEndTime(true);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  // UI state for calendars
  const [openFrom, setOpenFrom] = React.useState(false);
  const [openTo, setOpenTo] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = React.useState<Date | undefined>(undefined);
  const [noEndTime, setNoEndTime] = React.useState(false);

  React.useEffect(() => {
    if (noEndTime) {
      setDateTo(undefined);
      form.setValue("end_time_text", "", { shouldDirty: false });
      form.clearErrors("end_time_text");
    }
  }, [noEndTime, form]);

  const onSubmit = async (data: FormData) => {
    // Require a start date
    if (!dateFrom) {
      form.setError("start_time_text", {
        type: "validate",
        message: "Pick a start date and time.",
      });
      return;
    }
    // Clamp start within window
    if (dateFrom < today || dateFrom > maxDate) {
      form.setError("start_time_text", {
        type: "validate",
        message: "Start date must be within 3 months from today.",
      });
      return;
    }

    // If no end time is set, save only start_time and clear end_time
    if (noEndTime) {
      const [sh = "00", sm = "00"] = (data.start_time_text || "09:00").split(
        ":"
      );
      const start = new Date(dateFrom);
      start.setHours(Number(sh) || 0, Number(sm) || 0, 0, 0);
      form.clearErrors();
      await updateGroup(groupId, {
        start_time: start.toISOString(),
        end_time: null,
      } as any);
      onNext();
      return;
    }

    // Otherwise, require end date and validate
    if (!dateTo) {
      form.setError("end_time_text", {
        type: "validate",
        message: "Pick an end date and time.",
      });
      return;
    }
    if (dateTo < today || dateTo > maxDate) {
      form.setError("end_time_text", {
        type: "validate",
        message: "End date must be within 3 months from today.",
      });
      return;
    }
    if (dateTo < dateFrom) {
      form.setError("end_time_text", {
        type: "validate",
        message: "End must be after start.",
      });
      return;
    }

    const [sh = "00", sm = "00"] = (data.start_time_text || "09:00").split(":");
    const [eh = "00", em = "00"] = (data.end_time_text || "10:00").split(":");
    const start = new Date(dateFrom);
    start.setHours(Number(sh) || 0, Number(sm) || 0, 0, 0);
    const end = new Date(dateTo);
    end.setHours(Number(eh) || 0, Number(em) || 0, 0, 0);

    await updateGroup(groupId, {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
    onNext();
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-4">Date and time</h2>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="gap-3 flex flex-col"
        >
          <div className="flex w-full min-w-0 flex-col gap-3 rounded-lg bg-card p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-3">
                <Label htmlFor="date-from" className="px-1">
                  Starts on
                </Label>
                <Popover open={openFrom} onOpenChange={setOpenFrom}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="date-from"
                      className="w-full justify-between font-normal"
                      type="button"
                    >
                      {dateFrom
                        ? dateFrom.toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Pick a date"}
                      <ChevronDownIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date || undefined);
                        form.clearErrors("start_time_text");
                        setOpenFrom(false);
                      }}
                      disabled={{ before: today, after: maxDate }}
                      captionLayout="dropdown-months"
                      classNames={{
                        day: "h-9 w-9 p-0 font-normal bg-transparent aria-selected:opacity-100 rounded-full focus-visible:bg-transparent",
                        day_selected:
                          "bg-primary text-primary-foreground rounded-full hover:bg-primary hover:text-primary-foreground",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="time-from" className="invisible px-1">
                  From
                </Label>
                <FormField
                  control={form.control}
                  name="start_time_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="time"
                          id="time-from"
                          step="60"
                          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            form.clearErrors("start_time_text");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-6 rounded-lg bg-card p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-3">
                <Label htmlFor="date-to" className="px-1">
                  Finishes on
                </Label>
                <Popover open={openTo} onOpenChange={setOpenTo}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="date-to"
                      className="w-full justify-between font-normal"
                      type="button"
                      disabled={noEndTime}
                    >
                      {dateTo
                        ? dateTo.toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Pick a date"}
                      <ChevronDownIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      captionLayout="dropdown-months"
                      onSelect={(date) => {
                        setDateTo(date || undefined);
                        form.clearErrors("end_time_text");
                        setOpenTo(false);
                      }}
                      disabled={{ before: dateFrom ?? today, after: maxDate }}
                      classNames={{
                        day: "h-9 w-9 p-0 font-normal bg-transparent aria-selected:opacity-100 rounded-full focus-visible:bg-transparent",
                        day_selected:
                          "bg-primary text-primary-foreground rounded-full hover:bg-primary hover:text-primary-foreground",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="time-to" className="invisible px-1">
                  To
                </Label>
                <FormField
                  control={form.control}
                  name="end_time_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="time"
                          id="time-to"
                          step="60"
                          disabled={noEndTime}
                          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            form.clearErrors("end_time_text");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="no-end-time" className="text-sm font-medium">
                No set finish time
              </Label>
              <Switch
                id="no-end-time"
                checked={noEndTime}
                onCheckedChange={setNoEndTime}
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-md px-5"
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
