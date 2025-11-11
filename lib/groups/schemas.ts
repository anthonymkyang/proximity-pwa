import { z } from "zod";

export const detailsSchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  description: z.string().trim().optional().nullable(),
  category_id: z.string().uuid("Invalid category ID").optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  location_text: z.string().trim().optional().nullable(),
  postcode: z.string().trim().optional().nullable(),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
  house_rules: z.array(z.string().trim()).optional().nullable(),
  provided_items: z.array(z.string().trim()).optional().nullable(),
  max_attendees: z.number().optional().nullable(),
  is_public: z.boolean().optional().nullable(),
  status: z.string().optional().nullable(),
});
