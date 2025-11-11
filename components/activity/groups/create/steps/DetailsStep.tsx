"use client";

import TextareaAutosize from "react-textarea-autosize";

import { createClient } from "@/utils/supabase/client";

/**
 * Uploads a file to the 'group-media' bucket under /covers/.
 * Returns both a publicUrl (if bucket is public) and a signedUrl fallback.
 */
export async function uploadCover(
  file: File
): Promise<{ path: string; publicUrl?: string; signedUrl: string }> {
  const supabase = createClient();

  const path = `covers/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("group-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  // Try to get a public URL (works only if bucket is public)
  const { data: pub } = supabase.storage.from("group-media").getPublicUrl(path);
  const publicUrl = pub?.publicUrl;

  // Always create a signed URL as a reliable fallback
  const { data: signed, error: signErr } = await supabase.storage
    .from("group-media")
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days

  if (signErr) throw signErr;

  return { path, publicUrl, signedUrl: signed.signedUrl };
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { detailsSchema } from "@/lib/groups/schemas";
import { updateGroup } from "@/lib/groups/client";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEffect, useState } from "react";
import { useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Trash2, Loader2, ArrowRight } from "lucide-react";

type FormData = z.infer<typeof detailsSchema>;

export default function DetailsStep({
  groupId,
  onNext,
}: {
  groupId: string;
  onNext: () => void;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: "",
      category_id: "",
      description: "",
    },
  });
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [coverPreview, setCoverPreview] = useState<string>("");
  const [coverPath, setCoverPath] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function clearCover() {
    setCoverPreview("");
    setCoverPath("");
    try {
      // persist removal immediately so DB row stays in sync
      void updateGroup(groupId, { cover_image_url: null });
    } catch (e) {
      console.error("Failed to clear cover_image_url", e);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("group_categories")
        .select("id, name")
        .order("name", { ascending: true });
      if (!error && data)
        setCategories(data as Array<{ id: string; name: string }>);
      setLoadingCats(false);
    })();
  }, []);

  // Hydrate form with current group values
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("groups")
          .select("title, category_id, description, cover_image_url")
          .eq("id", groupId)
          .maybeSingle();
        if (error) return;
        if (!active || !data) return;
        form.reset({
          // Do not pre-populate title; show empty unless a real title exists
          title:
            data.title &&
            data.title.trim() &&
            data.title.trim().toLowerCase() !== "untitled group"
              ? data.title
              : "",
          category_id: data.category_id ?? "",
          description: data.description ?? "",
        });
        setCoverPath(data.cover_image_url ?? "");
        // Hydrate preview from stored path if present
        const existingPath = data.cover_image_url ?? "";
        if (existingPath) {
          try {
            if (/^https?:\/\//i.test(existingPath)) {
              setCoverPreview(existingPath);
            } else {
              const supa = createClient();
              const { data: sig } = await supa.storage
                .from("group-media")
                .createSignedUrl(existingPath, 60 * 60 * 24 * 30);
              if (sig?.signedUrl) setCoverPreview(sig.signedUrl);
            }
          } catch (e) {
            console.warn("Could not sign existing cover path", e);
          }
          setCoverPath(existingPath);
        } else {
          setCoverPreview("");
          setCoverPath("");
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  // (Effects to watch cover_image_url and initialize preview removed)

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
    });

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function getCroppedBlob(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
  ) {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
    );
  }

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    const dataUrl = await readFile(f);
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropOpen(true);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    await handleFiles(e.dataTransfer.files);
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveCropped = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
    const file = new File([blob], `cover-${crypto.randomUUID()}.jpg`, {
      type: "image/jpeg",
    });
    // upload to Supabase Storage
    const result: any = await uploadCover(file);
    // Always store the Storage path in DB; use a signed URL only for preview
    const storagePath =
      result?.path ?? (typeof result === "string" ? result : "");
    const signedForPreview = result?.signedUrl ?? "";

    if (signedForPreview) setCoverPreview(signedForPreview);
    setCoverPath(storagePath);
    try {
      await updateGroup(groupId, { cover_image_url: storagePath });
    } catch (e) {
      // non-fatal for UI, but log in dev
      console.error("Failed to persist cover_image_url", e);
    }
    setCropOpen(false);
    setImageSrc(null);
  };

  const onSubmit = async (data: FormData) => {
    const patch = {
      title: data.title?.trim() || "",
      category_id: data.category_id ? data.category_id : null,
      description: data.description?.trim() ? data.description : null,
    } as const;

    await updateGroup(groupId, patch);
    onNext();
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-4">Group details</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Give your group a title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm">
            <FormField
              control={form.control}
              name="category_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <Field>
                    <FieldLabel>Type of group</FieldLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v)}
                      disabled={loadingCats}
                    >
                      <SelectTrigger
                        aria-invalid={fieldState.invalid}
                        className={
                          fieldState.invalid
                            ? "ring-2 ring-destructive border-destructive"
                            : undefined
                        }
                      >
                        <SelectValue
                          placeholder={
                            loadingCats ? "Loading..." : "Select type"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => {
                const val = field.value ?? "";
                const remaining = 1500 - val.length;
                return (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <InputGroup>
                        <TextareaAutosize
                          {...field}
                          value={val}
                          data-slot="input-group-control"
                          className="flex field-sizing-content min-h-16 w-full resize-none rounded-md bg-transparent px-3 pt-3 pb-2.5 text-base transition-[color,box-shadow] outline-none md:text-sm"
                          placeholder="Describe what this group is about"
                          maxLength={1500}
                        />
                        <InputGroupAddon align="block-end">
                          <InputGroupText className="text-muted-foreground text-xs">
                            {remaining} characters left
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm">
            <FormItem>
              <FormLabel>Cover image</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  {coverPreview ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          clearCover();
                        }}
                        className="absolute top-1 right-1 md:top-2 md:right-2 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm shadow-md ring-1 ring-black/20"
                        aria-label="Remove cover image"
                        title="Remove cover image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={[
                        "aspect-video w-full rounded-md border border-dashed grid place-items-center text-sm text-muted-foreground",
                        dragActive ? "bg-muted/50" : "bg-transparent",
                      ].join(" ")}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActive(false);
                      }}
                      onDrop={onDrop}
                      role="button"
                      aria-label="Upload cover image"
                    >
                      <div className="flex flex-col items-center gap-2 p-4 text-center">
                        <p>Drag and drop an image here, or choose a file</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose file
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={onInputChange}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </FormControl>
            </FormItem>
          </div>

          <Dialog open={cropOpen} onOpenChange={setCropOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Crop cover image</DialogTitle>
              </DialogHeader>
              <div className="relative h-[50vh] w-full bg-muted rounded-md overflow-hidden">
                {imageSrc ? (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    aspect={16 / 9}
                    onCropComplete={onCropComplete}
                    objectFit="horizontal-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="text-sm">Zoom</div>
                <Slider
                  value={[zoom]}
                  onValueChange={(v) => setZoom(v[0] || 1)}
                  min={1}
                  max={3}
                  step={0.01}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setCropOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={saveCropped}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4">
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-md"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <span className="inline-flex items-center justify-center">
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Continue
                </span>
              ) : (
                <span>Continue</span>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
