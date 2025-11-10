import { createClient } from "@/utils/supabase/client"; // your browser client

export async function uploadCover(file: File): Promise<string> {
  const supabase = createClient();
  const path = `covers/${crypto.randomUUID()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from("group-media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
  const { data: url } = supabase.storage.from("group-media").getPublicUrl(path);
  return url.publicUrl;
}
