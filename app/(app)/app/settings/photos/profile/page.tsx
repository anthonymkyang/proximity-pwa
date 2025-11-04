"use client";

import { useEffect, useRef, useState } from "react";
import { prepareImageFileForUpload } from "@/lib/images/prepareUpload";
import { useRouter } from "next/navigation";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ImageIcon, Trash2, Lock, Images, ChevronRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HelpCircleIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

const MAX_SLOTS = 5;

function EmptyTile({ index, onAdd }: { index: number; onAdd: () => void }) {
  const style = (
    index === 0 ? { gridRowStart: "span 2", gridColumnStart: "span 2" } : {}
  ) as React.CSSProperties;

  return (
    <button
      type="button"
      onClick={onAdd}
      className="relative h-full w-full border rounded-md overflow-hidden grid place-items-center bg-muted text-muted-foreground"
      style={style}
      aria-label="Add photo"
    >
      <ImageIcon className="h-5 w-5" />
    </button>
  );
}

// Cache signed URLs by objectKey+variant so we don't thrash the network
const photoUrlCache = new Map<string, string>();
function cacheKey(objectKey: string, variant: string) {
  return `${objectKey}::${variant}`;
}
function invalidateUrl(objectKey: string) {
  // Bust all variants for this key
  for (const key of Array.from(photoUrlCache.keys())) {
    if (key.startsWith(`${objectKey}::`)) photoUrlCache.delete(key);
  }
}

/**
 * Create a signed URL with Supabase transforms so we deliver
 * appropriately sized images for the grid.
 * NOTE: Supabase typings only allow `format: 'origin'`, so we omit format.
 */
async function getDisplayUrl(
  objectKey: string,
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
  }
): Promise<string> {
  const variant = transform
    ? `w${transform.width ?? ""}h${transform.height ?? ""}q${
        transform.quality ?? ""
      }r${transform.resize ?? ""}`
    : "orig";
  const k = cacheKey(objectKey, variant);
  if (photoUrlCache.has(k)) return photoUrlCache.get(k)!;

  const supabase = createClient();
  const bucket = "profile_public";

  // Build options only with allowed keys to satisfy Supabase types
  const opts: any = transform
    ? {
        transform: {
          width: transform.width,
          height: transform.height,
          quality: transform.quality,
          resize: transform.resize,
        },
      }
    : undefined;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectKey, 3600, opts);

  if (error || !data?.signedUrl) {
    console.error("Failed to get signed URL for", objectKey, error);
    return "";
  }

  photoUrlCache.set(k, data.signedUrl);
  return data.signedUrl;
}

// --- Types ---
interface PublicPhotoRow {
  id: string;
  user_id: string;
  object_key: string;
  is_main: boolean | null;
  position: number | null;
  created_at?: string;
}

// Decide target pixel dimensions for tiles. We scale by device pixel ratio for sharpness.
function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1)));
}
function getTileDims(index: number) {
  const dpr = getDevicePixelRatio();
  // Small tiles ~140-160 CSS px in our grid -> request ~320px @1x, scale by DPR
  if (index === 0) {
    const base = 320 * 2; // 2x2 tile ~ 280-320px, so ask ~640 @1x
    const size = base * dpr;
    return { width: size, height: size };
  } else {
    const base = 320; // square
    const size = base * dpr;
    return { width: size, height: size };
  }
}

function SortablePhoto({
  p,
  index,
  isEditMode,
  onDelete,
}: {
  p: PublicPhotoRow;
  index: number;
  isEditMode: boolean;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: p.id });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const { width, height } = getTileDims(index);
    getDisplayUrl(p.object_key, {
      width,
      height,
      quality: 70,
      resize: "cover",
    }).then((u) => mounted && setSrc(u));
    return () => {
      mounted = false;
    };
  }, [p.object_key, index]);

  const setCombinedRef = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    setNodeRef(el);
  };

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    ...(index === 0
      ? { gridRowStart: "span 2", gridColumnStart: "span 2" }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      ref={setCombinedRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative h-full w-full border rounded-md overflow-hidden select-none touch-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => e.preventDefault()}
    >
      {src ? (
        <img
          src={src}
          alt="Profile photo"
          className="h-full w-full object-cover pointer-events-none z-1"
        />
      ) : (
        <div className="h-full w-full grid place-items-center bg-muted z-1">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {isEditMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(p.id);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="absolute top-1 right-1 md:top-2 md:right-2 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm shadow-md pointer-events-auto ring-1 ring-black/20"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {p.is_main ? (
        <span className="absolute bottom-2 left-2 z-50 rounded bg-background/80 px-2 py-0.5 text-[10px] font-medium border">
          Main
        </span>
      ) : null}
    </div>
  );
}

function StaticPhoto({
  p,
  index,
  onEnterEdit,
}: {
  p: PublicPhotoRow;
  index: number;
  onEnterEdit: () => void;
}) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let mounted = true;
    const { width, height } = getTileDims(index);
    getDisplayUrl(p.object_key, {
      width,
      height,
      quality: 70,
      resize: "cover",
    }).then((u) => mounted && setSrc(u));
    return () => {
      mounted = false;
    };
  }, [p.object_key, index]);

  const style = (
    index === 0 ? { gridRowStart: "span 2", gridColumnStart: "span 2" } : {}
  ) as React.CSSProperties;
  const pressTimer = useRef<number | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    startPoint.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    pressTimer.current = window.setTimeout(() => {
      onEnterEdit();
    }, 350);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startPoint.current) return;
    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      clearTimer();
    }
  }
  function onPointerUp() {
    clearTimer();
  }
  function onPointerCancel() {
    clearTimer();
  }
  function onPointerLeave() {
    clearTimer();
  }

  return (
    <div
      style={style}
      className="group relative h-full w-full border rounded-md overflow-hidden select-none touch-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] z-0"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      {src ? (
        <img
          src={src}
          alt="Profile photo"
          className="h-full w-full object-cover pointer-events-none z-2"
        />
      ) : (
        <div className="h-full w-full grid place-items-center bg-muted z-2">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      {p.is_main ? (
        <span className="absolute bottom-2 left-2 z-50 rounded bg-background/80 px-2 py-0.5 text-[10px] font-medium border">
          Main
        </span>
      ) : null}
    </div>
  );
}

function computeVisualOrder(
  photos: PublicPhotoRow[],
  items: string[]
): ({ kind: "photo"; p: PublicPhotoRow } | { kind: "empty" })[] {
  // Map photos by id for quick lookup
  const byId = new Map(photos.map((p) => [p.id, p]));
  // First, list photos in the order of `items`
  const orderedPhotos: PublicPhotoRow[] = items
    .map((id) => byId.get(id))
    .filter((p): p is PublicPhotoRow => !!p);

  // If items is empty (first render), fall back to photos array order
  const base = orderedPhotos.length ? orderedPhotos : photos;

  // Pad with empties up to MAX_SLOTS
  const result: ({ kind: "photo"; p: PublicPhotoRow } | { kind: "empty" })[] =
    base.map((p) => ({ kind: "photo", p }));

  for (let i = result.length; i < MAX_SLOTS; i++) {
    result.push({ kind: "empty" });
  }
  return result.slice(0, MAX_SLOTS);
}

export default function ProfilePhotosPage() {
  const router = useRouter();

  // --- State ---
  const [photos, setPhotos] = useState<PublicPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // client-only DnD
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  // --- Load once on mount ---
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The ids we render in the current, user-defined order
  const [items, setItems] = useState<string[]>([]);
  const visual = computeVisualOrder(photos, items);

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPhotos([]);
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("profile_photos_public")
        .select("id,user_id,object_key,is_main,position,created_at")
        .eq("user_id", user.id);
      if (error) throw error;

      // sort by position (nulls last) then created_at
      const rows = (data ?? []).sort((a, b) => {
        const pa = a.position ?? Number.POSITIVE_INFINITY;
        const pb = b.position ?? Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return ta - tb;
      });

      setPhotos(rows);
      setItems(rows.slice(0, MAX_SLOTS).map((r) => r.id));
    } catch (e) {
      console.error(e);
      setPhotos([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // click outside to exit edit mode
  useEffect(() => {
    function onDocPointerDown(ev: PointerEvent) {
      if (!gridRef.current) return;
      const target = ev.target as Node | null;
      if (target && !gridRef.current.contains(target)) {
        setIsEditMode(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  // --- Upload flow ---
  async function handlePickFile() {
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Optimise and convert to WebP before upload
      const processed = await prepareImageFileForUpload(file, 2048, 0.8);
      const ext = "webp";
      const res = await fetch("/api/photos/public/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext }),
      });
      const { uploadUrl, objectKey, error } = await res.json();
      if (error || !uploadUrl || !objectKey)
        throw new Error(error || "Failed to get upload URL");

      const put = await fetch(uploadUrl, { method: "PUT", body: processed });
      if (!put.ok) throw new Error("Upload failed");

      const is_main = photos.length === 0;
      const conf = await fetch("/api/photos/public/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey, is_main, position: photos.length }),
      });
      const j = await conf.json();
      if (!conf.ok) throw new Error(j?.error || "Confirm failed");

      // TODO: Server-side variants to be implemented later for multi-resolution serving.

      // Optimistically add new item locally
      setPhotos((prev) => {
        const newPhoto: PublicPhotoRow = {
          id: j.photo?.id || crypto.randomUUID(),
          user_id: j.photo?.user_id || "",
          object_key: objectKey,
          is_main,
          position: prev.length,
          created_at: new Date().toISOString(),
        };
        const next = [...prev, newPhoto];
        setItems(next.map((r) => r.id));
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // --- Delete ---
  async function handleDelete(id: string) {
    try {
      const target = photos.find((p) => p.id === id);
      if (target) invalidateUrl(target.object_key);

      // Optimistic remove
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setItems((prev) => prev.filter((x) => x !== id));

      const res = await fetch(`/api/photos/public/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
    } catch (e) {
      console.error(e);
      // Resync on failure
      load();
    }
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  // Ensure we don't run overlapping reorders
  const reorderInFlight = useRef<Promise<void> | null>(null);
  const saveTimer = useRef<number | null>(null);

  async function saveOrder(updatedItems: string[]) {
    try {
      const res = await fetch("/api/photos/public/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: updatedItems }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("Failed to batch reorder", j?.error || res.statusText);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const updatedItems = arrayMove(items, oldIndex, newIndex);

    // Optimistic UI
    setItems(updatedItems);
    setPhotos((prev) => {
      const byId: Record<string, PublicPhotoRow> = Object.fromEntries(
        prev.map((p) => [p.id, p])
      );
      return updatedItems.map((id, index) => ({
        ...byId[id],
        position: index,
        is_main: index === 0,
      }));
    });

    // Debounce network writes to avoid multiple PATCH bursts
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveTimer.current = window.setTimeout(() => {
      saveOrder(updatedItems).catch(console.error);
    }, 150);
  }

  return (
    <div className="mx-auto w-full max-w-xl pb-[calc(72px+env(safe-area-inset-bottom))] px-4">
      <TopBar
        leftContent={<BackButton />}
        rightContent={
          !isEditMode ? (
            <div className="flex items-center gap-2">
              <Drawer open={addOpen} onOpenChange={setAddOpen}>
                <DrawerTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-full"
                    aria-label="Add photo"
                    title="Add photo"
                  >
                    +
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Add photo</DrawerTitle>
                    <DrawerDescription>Select a source</DrawerDescription>
                  </DrawerHeader>
                  <div className="px-4 pb-4">
                    <Item
                      variant="outline"
                      onClick={() => {
                        setAddOpen(false);
                        handlePickFile();
                      }}
                      className="bg-card"
                    >
                      <ItemMedia variant="icon">
                        <ImageIcon className="h-5 w-5" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>Upload from device</ItemTitle>
                        <ItemDescription>
                          Choose a photo from your device
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions />
                    </Item>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() => setIsEditMode(false)}
            >
              Done
            </Button>
          )
        }
      >
        <h1 className="px-1 pb-2 text-3xl font-extrabold tracking-tight">
          Profile photos
        </h1>
      </TopBar>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        ref={gridRef}
        className="grid grid-cols-4 gap-2 mt-4 select-none touch-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
        style={{ gridAutoRows: "88px" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isClient && isEditMode ? (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items} strategy={rectSortingStrategy}>
                {visual.map((entry, index) => {
                  if (entry.kind === "photo") {
                    const p = entry.p;
                    return (
                      <SortablePhoto
                        key={p.id}
                        p={p}
                        index={index}
                        isEditMode={true}
                        onDelete={handleDelete}
                      />
                    );
                  }
                  // empty slot in edit mode (non-draggable)
                  return (
                    <EmptyTile
                      key={`empty-${index}`}
                      index={index}
                      onAdd={() => {
                        // Prefer opening the drawer, which then triggers the file picker
                        setAddOpen(true);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <>
            {visual.map((entry, index) => {
              if (entry.kind === "photo") {
                return (
                  <StaticPhoto
                    key={entry.p.id}
                    p={entry.p}
                    index={index}
                    onEnterEdit={() => setIsEditMode(true)}
                  />
                );
              }
              return (
                <EmptyTile
                  key={`empty-${index}`}
                  index={index}
                  onAdd={() => {
                    setAddOpen(true);
                  }}
                />
              );
            })}
          </>
        )}
      </div>

      <div className="mt-4">
        <Alert className="border-0">
          <HelpCircleIcon className="h-4 w-4" />
          <AlertTitle>Managing photos</AlertTitle>
          <AlertDescription>
            Press and hold to drag and reorder your photos. Keep holding to
            reveal the delete button, then tap it to remove a photo.
          </AlertDescription>
        </Alert>
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold text-muted-foreground px-1 uppercase">
        More
      </h2>
      <div className="space-y-3">
        <Item
          variant="outline"
          onClick={() => {
            router.push("/app/settings/photos/private");
          }}
          className="bg-card"
        >
          <ItemMedia variant="icon">
            <Lock className="h-5 w-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Manage private photos</ItemTitle>
            <ItemDescription>Organise your private pics</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </ItemActions>
        </Item>

        <Item
          variant="outline"
          onClick={() => {
            router.push("/app/settings/photos/albums");
          }}
          className="bg-card"
        >
          <ItemMedia variant="icon">
            <Images className="h-5 w-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Manage photo albums</ItemTitle>
            <ItemDescription>Manage your sharable albums</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </ItemActions>
        </Item>
      </div>
    </div>
  );
}
