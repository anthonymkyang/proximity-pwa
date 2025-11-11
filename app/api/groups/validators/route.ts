import { z } from "zod";

export const detailsSchema = z.object({
  title: z.string().trim().min(3, { message: "Title is too short" }).max(120),
  category_id: z.string().uuid({ message: "Please choose a type" }),
  description: z.string().min(10).max(5000).optional().or(z.literal("")),
  cover_image_url: z
    .string()
    .regex(/^[\w-]+\/[\w.-]+\.(jpg|jpeg|png|webp)$/i, {
      message: "Invalid image path",
    })
    .optional()
    .or(z.literal("")),
});

export const scheduleSchema = z
  .object({
    start_time: z.coerce.date(),
    // end_time can be null/undefined when "No set finish time" is chosen
    end_time: z.preprocess(
      (v) => (v === "" ? null : v),
      z.coerce.date().nullable().optional()
    ),
  })
  .refine(
    (v) => {
      // if no end_time provided, it's valid
      if (!v.end_time) return true;
      return v.start_time < v.end_time;
    },
    {
      message: "End must be after start",
      path: ["end_time"],
    }
  );

export const locationSchema = z.object({
  // Optional fields. Empty strings are normalized to null.
  location_text: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(200).nullable().optional()
  ),
  postcode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(16).nullable().optional()
  ),
  location_lat: z.preprocess(
    (v) => (v === "" ? null : v),
    z.number().gte(-90).lte(90).nullable().optional()
  ),
  location_lng: z.preprocess(
    (v) => (v === "" ? null : v),
    z.number().gte(-180).lte(180).nullable().optional()
  ),
});

export const hostsSchema = z.object({
  cohost_ids: z.array(z.string().uuid()).max(3),
  max_attendees: z.number().int().positive().optional(),
});

export const rulesSchema = z.object({
  // Allow empty arrays, but when items exist, require at least 3 chars each.
  house_rules: z.array(z.string().trim().min(3)).max(25).optional().default([]),
  provided_items: z
    .array(z.string().trim().min(3))
    .max(25)
    .optional()
    .default([]),
});

export const visibilitySchema = z.object({
  is_public: z.boolean(),
  status: z.enum(["active", "in_progress"]),
});
