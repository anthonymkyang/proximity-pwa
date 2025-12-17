"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  ArrowUp,
  ArrowLeft,
  MoreVertical,
  UserRound,
  UserPlus,
  Pin,
  Shield,
  Flag,
  Check,
  CheckCheck,
  Reply,
  Copy,
  Info,
  Trash2,
  X,
  Languages,
  Image,
  BookOpen,
  MapPin,
  UsersRound,
  Calendar,
  Search,
  Home,
  Building,
  Building2,
  GraduationCap,
  School,
  Hospital,
  Droplet,
  Trees,
  UtensilsCrossed,
  Coffee,
  Beer,
  Hotel,
  ShoppingBag,
  ShoppingCart,
  Landmark,
  Banknote,
  Mail,
  BookMarked,
  Theater,
  Film,
  Train,
  Bus,
  ParkingCircle,
  Fuel,
  Church,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvatarProxyUrl } from "@/lib/profiles/getAvatarProxyUrl";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { useWebLLM } from "@/hooks/useWebLLM";
import { AIToolsDialog } from "@/components/ai/AIToolsDialog";
import { usePresence } from "@/components/providers/presence-context";
import maplibregl, {
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapDirections from "@/components/map/MapDirections";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  conversation_id?: string;
  reply_to_id?: string | null;
  reply_to_body?: string | null;
  reply_to_sender_id?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  deleted_at?: string | null;
  my_reaction?: string | null;
  reaction_counts?: Record<string, number>;
  translation?: {
    translatedText: string;
    detectedLanguage?: string | null;
    targetLanguage: string;
  } | null;
  profiles?: {
    profile_title?: string | null;
    avatar_url?: string | null;
  } | null;
  message_type?: "text" | "location" | "link" | null;
  metadata?: {
    location?: {
      lat: number;
      lng: number;
      address?: string;
    };
    link?: {
      url: string;
      title?: string;
      description?: string;
      image?: string;
      siteName?: string;
      favicon?: string;
    };
  } | null;
};

type MessageTranslation = {
  translatedText: string;
  detectedLanguage?: string;
  targetLanguage: string;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string;
};

const sortUniqueMessages = (list: Message[]) => {
  const byId = new Map<string, Message>();
  list.forEach((m) => {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
    }
  });
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const REACTIONS = [
  { type: "heart", emoji: "❤️", src: "/emoji/red-heart.json" },
  { type: "fire", emoji: "🔥", src: "/emoji/fire.json" },
  {
    type: "imp",
    emoji: "😈",
    src: "/emoji/imp-smile.json",
    restFrameFraction: 0.5,
  },
  { type: "laugh", emoji: "😂", src: "/emoji/laughing.json" },
  { type: "surprised", emoji: "😮", src: "/emoji/surprised.json" },
];

const reactionMeta = REACTIONS.reduce<
  Record<string, (typeof REACTIONS)[number]>
>((acc, r) => {
  acc[r.type] = r;
  return acc;
}, {});

const normalizeMessage = (m: Message): Message => ({
  ...m,
  reaction_counts: m.reaction_counts ?? {},
  my_reaction: m.my_reaction ?? null,
  conversation_id: m.conversation_id,
});

const PAGE_SIZE = 30;
const LONG_PRESS_MS = 260;

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) {
    return `Today, ${time}`;
  }
  if (isYesterday) {
    return `Yesterday, ${time}`;
  }

  // Check if within last 6 days
  const daysAgo = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysAgo < 7) {
    const dayName = date.toLocaleString("en-US", { weekday: "long" });
    return `${dayName}, ${time}`;
  }

  // For older dates, show "5 Dec" format
  const dateStr2 = date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
  });
  return `${dateStr2}, ${time}`;
};

// Link preview component for message bubbles
function LinkPreview({
  link,
  onClick,
  isMe,
}: {
  link: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
  };
  onClick: () => void;
  isMe?: boolean;
}) {
  return (
    <div
      className="w-full cursor-pointer transition-colors"
      onClick={onClick}
    >
      {link.image && (
        <div className="w-full aspect-[1.91/1] bg-muted relative rounded overflow-hidden shadow-md">
          <img
            src={link.image}
            alt={link.title || "Link preview"}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              e.currentTarget.parentElement!.style.display = "none";
            }}
          />
        </div>
      )}
      <div className="py-3 space-y-1">
        {link.siteName && (
          <p className={`text-[10px] uppercase tracking-wide ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
            {link.siteName}
          </p>
        )}
        {link.title && (
          <p className={`font-semibold text-sm line-clamp-2 ${isMe ? "text-white" : ""}`}>{link.title}</p>
        )}
        {link.description && (
          <p className={`text-xs line-clamp-2 ${isMe ? "text-white/80" : "text-muted-foreground"}`}>
            {link.description}
          </p>
        )}
        <div className="flex items-center gap-1.5">
          {link.favicon && (
            <img
              src={link.favicon}
              alt=""
              className="w-3 h-3 shrink-0"
              onError={(e) => {
                // Hide favicon on error
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <p className={`text-[10px] truncate ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
            {(() => {
              try {
                const url = new URL(link.url);
                const hostname = url.hostname.replace(/^www\./, '');
                const pathParts = url.pathname.split('/').filter(Boolean);

                if (pathParts.length === 0) {
                  return hostname;
                }

                // Show domain + first path segment + ... if there are more segments
                const firstPath = pathParts[0];
                const hasMore = pathParts.length > 1;
                return `${hostname}/${firstPath}${hasMore ? '/...' : ''}`;
              } catch {
                return link.url;
              }
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}

// Static map preview component for message bubbles
function StaticMapPreview({
  location,
  onClick,
}: {
  location: { lat: number; lng: number };
  onClick: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MaplibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // If map already exists, just update center and return
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter([location.lng, location.lat]);
      return;
    }

    let mounted = true;

    const initMap = async () => {
      try {
        const styleRes = await fetch("/maps/proximity-dark.json");
        const style: StyleSpecification = await styleRes.json();

        if (!mounted || !mapRef.current) return;

        const map = new maplibregl.Map({
          container: mapRef.current,
          style,
          center: [location.lng, location.lat],
          zoom: 15,
          interactive: false, // Disable all interactions
          attributionControl: false,
        });

        map.on("load", () => {
          if (!mounted) return;

          // Hide road numbers/shields
          const layers = map.getStyle().layers;
          if (layers) {
            layers.forEach((layer) => {
              if (layer.type !== "symbol" || !layer.layout) return;
              const textField = layer.layout["text-field"] as unknown;
              const hasRefToken = (field: unknown) => {
                if (typeof field === "string") return field.includes("{ref}");
                if (Array.isArray(field))
                  return JSON.stringify(field).includes('"ref"');
                return false;
              };
              if (hasRefToken(textField)) {
                map.setLayoutProperty(layer.id, "visibility", "none");
              }
            });
          }

          // Add marker at location with primary color
          const markerEl = document.createElement("div");
          const pinSVG = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          pinSVG.setAttribute("viewBox", "0 0 24 24");
          pinSVG.setAttribute("width", "32");
          pinSVG.setAttribute("height", "32");
          pinSVG.style.cssText = `
            filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
            color: hsl(var(--primary));
          `;
          pinSVG.innerHTML =
            '<path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';

          markerEl.appendChild(pinSVG);

          new maplibregl.Marker({
            element: markerEl,
            anchor: "bottom",
          })
            .setLngLat([location.lng, location.lat])
            .addTo(map);

          // Fade in after map loads
          setIsLoaded(true);
        });

        mapInstanceRef.current = map;
      } catch (error) {
        console.error("Error initializing static map preview:", error);
      }
    };

    initMap();

    return () => {
      mounted = false;
    };
  }, [location]);

  return (
    <div
      className="w-full h-40 rounded-lg overflow-hidden bg-muted cursor-pointer transition-opacity duration-500 shadow-md"
      style={{ opacity: isLoaded ? 1 : 0 }}
      onClick={onClick}
    >
      <div ref={mapRef} style={{ width: "100%", height: "160px" }} />
    </div>
  );
}

// Location viewer map component
function LocationViewerMap({
  location,
  onGetDirections,
}: {
  location: { lat: number; lng: number; address?: string };
  onGetDirections: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      try {
        const styleRes = await fetch("/maps/proximity-dark.json");
        const style: StyleSpecification = await styleRes.json();

        const map = new maplibregl.Map({
          container: mapRef.current!,
          style,
          center: [location.lng, location.lat],
          zoom: 15,
          pitch: 35,
          // @ts-expect-error antialias is supported
          antialias: true,
          attributionControl: false,
        });

        map.on("load", () => {
          // Add building extrusions (same as MapCanvas)
          const BUILDING_SOURCE_ID = "openfreemap-buildings";
          if (!map.getSource(BUILDING_SOURCE_ID)) {
            const labelLayerId = map
              .getStyle()
              .layers?.find(
                (layer) =>
                  layer.type === "symbol" &&
                  (layer.layout as { "text-field"?: unknown })?.["text-field"]
              )?.id;

            map.addSource(BUILDING_SOURCE_ID, {
              url: "https://tiles.openfreemap.org/planet",
              type: "vector",
            });

            map.addLayer(
              {
                id: "3d-buildings",
                source: BUILDING_SOURCE_ID,
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 15,
                filter: ["!=", ["get", "hide_3d"], true],
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0,
                    "#0f1113",
                    120,
                    "#13171b",
                    300,
                    "#161b20",
                  ],
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15,
                    0,
                    16,
                    ["get", "render_height"],
                  ],
                  "fill-extrusion-base": [
                    "step",
                    ["zoom"],
                    0,
                    16,
                    ["coalesce", ["get", "render_min_height"], 0],
                  ],
                  "fill-extrusion-opacity": 0.4,
                },
              },
              labelLayerId
            );
          }

          // Add marker at location with primary color - custom teardrop pin
          const markerEl = document.createElement("div");
          const pinSVG = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          pinSVG.setAttribute("viewBox", "0 0 24 24");
          pinSVG.setAttribute("width", "32");
          pinSVG.setAttribute("height", "32");
          pinSVG.style.filter = "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))";
          pinSVG.style.color = "hsl(var(--primary))";
          pinSVG.innerHTML =
            '<path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';

          markerEl.appendChild(pinSVG);

          new maplibregl.Marker({
            element: markerEl,
            anchor: "bottom",
          })
            .setLngLat([location.lng, location.lat])
            .addTo(map);
        });

        mapInstanceRef.current = map;
      } catch (error) {
        console.error("Error initializing location viewer map:", error);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [location]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Get Directions button */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <Button onClick={onGetDirections} className="w-full shadow-lg">
          Get directions
        </Button>
      </div>

      {/* Address overlay at top */}
      {location.address && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            <p className="text-sm font-medium">{location.address}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversationPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const supabase = useRef(createClient());
  const endRef = useRef<HTMLDivElement | null>(null);
  const reactionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const convoChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const reactionsChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const routeId = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id ?? null;
  const queryId = search.get("id");
  const conversationId = routeId ?? queryId ?? null;
  const [participantName, setParticipantName] = useState(
    search.get("name") ?? "Contact"
  );
  const [participantAvatar, setParticipantAvatar] = useState<string | null>(
    null
  );
  const [participantProfileTitle, setParticipantProfileTitle] = useState<
    string | null
  >(null);
  const participantInitials = useMemo(() => {
    return (
      participantName
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "C"
    );
  }, [participantName]);

  const { presence, currentUserId: presenceUserId } = usePresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [contactConnectionId, setContactConnectionId] = useState<string | null>(
    null
  );
  const [pinConnectionId, setPinConnectionId] = useState<string | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactNickname, setContactNickname] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [contactTelegram, setContactTelegram] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [aiToolsDialogOpen, setAiToolsDialogOpen] = useState(false);
  const [pendingTranslateMessage, setPendingTranslateMessage] =
    useState<Message | null>(null);
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [albumDrawerOpen, setAlbumDrawerOpen] = useState(false);
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [viewLocationModalOpen, setViewLocationModalOpen] = useState(false);
  const [viewingLocation, setViewingLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const [directionsDrawerOpen, setDirectionsDrawerOpen] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [locationMapReady, setLocationMapReady] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const locationMapRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const justSelectedAddressRef = useRef(false);
  const pinElementRef = useRef<HTMLDivElement | null>(null);
  const isDraggingMapRef = useRef(false);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);
  const pendingReceiptsRef = useRef<
    Record<string, { delivered_at: string | null; read_at: string | null }>
  >({});
  const receiptsChannelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const deliveryAttemptRef = useRef<Set<string>>(new Set());
  const typingBroadcastedRef = useRef(false);
  const typingSelfTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadingOlderRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const messageElsRef = useRef<Record<string, HTMLElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  const [visibleMessages, setVisibleMessages] = useState<Set<string>>(
    new Set()
  );
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const pendingReplyRef = useRef<{
    reply_to_id: string | null;
    reply_to_body: string | null;
    reply_to_sender_id: string | null;
  } | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const prevScrollTopRef = useRef<number | null>(null);
  const pendingPrependAdjustRef = useRef(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [focusedMessageRect, setFocusedMessageRect] = useState<DOMRect | null>(
    null
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [linkViewerDrawerOpen, setLinkViewerDrawerOpen] = useState(false);
  const [viewingLinkUrl, setViewingLinkUrl] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTargetRef = useRef<string | null>(null);
  const prevBodyOverflowRef = useRef<string | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{
      id: string;
      messageId: string;
      type: string;
      timestamp: number;
    }>
  >([]);
  const [translations, setTranslations] = useState<
    Record<string, MessageTranslation>
  >({});
  const [autoTranslateLanguages, setAutoTranslateLanguages] = useState<
    Set<string>
  >(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem("autoTranslateLanguages");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [stoppedAutoTranslateLanguages, setStoppedAutoTranslateLanguages] =
    useState<Set<string>>(new Set());
  // Track message IDs that existed when auto-translate was enabled for each language
  const preExistingMessagesRef = useRef<Record<string, Set<string>>>({});
  const {
    modelState,
    loadingProgress,
    translateText,
    detectLanguage,
    askSemantic,
    initializeModel,
    checkModelCached,
  } = useWebLLM();

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // ignore and fallback
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const handlePhotoSelect = useCallback(() => {
    photoInputRef.current?.click();
  }, []);

  const startLongPress = useCallback((id: string) => {
    console.log("startLongPress called for message:", id);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTargetRef.current = id;
    longPressTimerRef.current = setTimeout(() => {
      console.log("Long press timer fired for message:", id);
      const messageEl = messageElsRef.current[id];
      if (messageEl) {
        const rect = messageEl.getBoundingClientRect();
        setFocusedMessageRect(rect);
        setFocusedMessageId(id);
      }
      console.log("Setting reactionTargetId to:", id);
      setReactionTargetId(id);
      longPressTargetRef.current = null;
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTargetRef.current = null;
  }, []);

  const applyReactionLocal = useCallback(
    (
      messageId: string,
      actorUserId: string | null,
      prevType: string | null,
      nextType: string | null
    ) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const counts = { ...(m.reaction_counts ?? {}) };
          if (prevType && counts[prevType]) {
            const nextCount = Math.max(0, (counts[prevType] ?? 1) - 1);
            if (nextCount <= 0) delete counts[prevType];
            else counts[prevType] = nextCount;
          }
          if (nextType) {
            counts[nextType] = (counts[nextType] || 0) + 1;
          }
          const isMe =
            actorUserId != null && actorUserId === currentUserIdRef.current;
          return {
            ...m,
            reaction_counts: counts,
            my_reaction: isMe ? nextType ?? null : m.my_reaction ?? null,
          };
        })
      );
    },
    []
  );

  const showReactionError = useCallback((msg: string) => {
    setReactionError(msg);
    if (reactionErrorTimerRef.current) {
      clearTimeout(reactionErrorTimerRef.current);
    }
    reactionErrorTimerRef.current = setTimeout(() => {
      setReactionError(null);
      reactionErrorTimerRef.current = null;
    }, 4000);
  }, []);

  // Derive other user id from messages if missing (e.g., after refresh)
  useEffect(() => {
    if (otherUserId || !currentUserId) return;
    const firstOther = messages.find(
      (m) => m.sender_id && m.sender_id !== currentUserId
    );
    if (firstOther?.sender_id) {
      setOtherUserId(firstOther.sender_id);
    }
  }, [messages, currentUserId, otherUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!reactionTargetId) return;
    const handleOutside = (e: Event) => {
      const reactionEl = reactionMenuRef.current;
      const actionEl = actionMenuRef.current;
      // Don't close if clicking inside either menu
      if (reactionEl && reactionEl.contains(e.target as Node)) return;
      if (actionEl && actionEl.contains(e.target as Node)) return;
      setReactionTargetId(null);
      setFocusedMessageId(null);
      setFocusedMessageRect(null);
      cancelLongPress();
    };
    document.addEventListener("pointerdown", handleOutside, true);
    return () =>
      document.removeEventListener("pointerdown", handleOutside, true);
  }, [reactionTargetId, cancelLongPress]);

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  // Fetch new messages when user returns to tab
  useEffect(() => {
    if (!conversationId) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible, fetching new messages");
        try {
          const res = await fetch(`/api/messages/${conversationId}?limit=30`);
          const data = await res.json();
          if (res.ok && data.messages) {
            const incoming = ((data.messages as Message[]) ?? [])
              .filter((m) => !messageIdsRef.current.has(m.id))
              .map((m) =>
                normalizeMessage({
                  ...m,
                  conversation_id:
                    m.conversation_id ?? conversationId ?? undefined,
                })
              );

            if (incoming.length > 0) {
              console.log(
                `Found ${incoming.length} new messages while tab was hidden`
              );

              // Load translations from database for new messages
              const translationsFromDb: Record<string, MessageTranslation> = {};
              ((data.messages as Message[]) ?? []).forEach((m) => {
                if (m.translation && !messageIdsRef.current.has(m.id)) {
                  translationsFromDb[m.id] = {
                    translatedText: m.translation.translatedText,
                    detectedLanguage:
                      m.translation.detectedLanguage || undefined,
                    targetLanguage: m.translation.targetLanguage,
                  };
                }
              });
              setTranslations((prev) => ({ ...prev, ...translationsFromDb }));

              setMessages((prev) => sortUniqueMessages([...prev, ...incoming]));
              shouldAutoScrollRef.current = true;
            }
          }
        } catch (err) {
          console.error("Failed to fetch messages on visibility change:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [conversationId]);

  useEffect(() => {
    setVisibleMessages(new Set());
    initialScrollDoneRef.current = false;
    setFocusedMessageId(null);
    setReplyTarget(null);
    setReactionTargetId(null);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      if (reactionErrorTimerRef.current) {
        clearTimeout(reactionErrorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-message-id");
          if (!id) return;
          if (!entry.isIntersecting) return;
          setVisibleMessages((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          observer.unobserve(entry.target);
        });
      },
      { root: listRef.current, threshold: 0.15 }
    );

    Object.entries(messageElsRef.current).forEach(([id, el]) => {
      if (!el || visibleMessages.has(id)) return;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [messages, visibleMessages]);

  // load initial messages + current user (paged)
  useEffect(() => {
    const load = async () => {
      if (!conversationId) {
        setInitialLoading(false);
        return;
      }
      try {
        setInitialLoading(true);
        setHasMore(false);
        setLoadingOlder(false);
        setVisibleMessages(new Set());
        const {
          data: { user },
        } = await supabase.current.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const res = await fetch(
          `/api/messages/${conversationId}?limit=${PAGE_SIZE}`
        );
        const data = await res.json();
        if (res.ok) {
          shouldAutoScrollRef.current = true;
          const normalized = (data.messages as Message[] | undefined)?.map(
            (m) =>
              normalizeMessage({
                ...m,
                conversation_id:
                  m.conversation_id ?? conversationId ?? undefined,
              })
          );
          setMessages(sortUniqueMessages(normalized ?? []));

          // Load translations from database
          const translationsFromDb: Record<string, MessageTranslation> = {};
          (data.messages as Message[] | undefined)?.forEach((m) => {
            if (m.translation) {
              translationsFromDb[m.id] = {
                translatedText: m.translation.translatedText,
                detectedLanguage: m.translation.detectedLanguage || undefined,
                targetLanguage: m.translation.targetLanguage,
              };
            }
          });
          setTranslations(translationsFromDb);
          const otherMsg = (data.messages as Message[] | undefined)?.find(
            (m) => m.sender_id && m.sender_id !== user?.id
          );
          const fallbackTitle =
            otherMsg?.profiles?.profile_title ??
            data.messages?.[0]?.profiles?.profile_title ??
            null;
          const apiName =
            data.other?.display_name ??
            data.other?.profile_title ??
            fallbackTitle ??
            null;
          const apiProfileTitle =
            data.other?.profile_title ?? fallbackTitle ?? null;
          const apiOtherId = data.other?.user_id ?? null;
          if (apiOtherId) setOtherUserId(apiOtherId);
          else {
            // derive other user id from messages list if possible
            const firstOther = (data.messages as Message[] | undefined)?.find(
              (m) => m.sender_id && m.sender_id !== user?.id
            );
            if (firstOther?.sender_id) setOtherUserId(firstOther.sender_id);
          }
          if (apiName) setParticipantName(apiName);
          if (apiProfileTitle) setParticipantProfileTitle(apiProfileTitle);
          const rawAvatar =
            data.other?.avatar_url ??
            (data.messages as Message[] | undefined)?.find(
              (m) => m.sender_id !== user?.id && m.profiles?.avatar_url
            )?.profiles?.avatar_url ??
            null;
          const proxied = getAvatarProxyUrl(rawAvatar);
          if (proxied) {
            setParticipantAvatar(proxied);
          }
          setHasMore(Boolean(data.hasMore));
        }
      } catch {
        // ignore
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [conversationId]);

  // simple realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.current
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          console.log("Realtime INSERT event:", payload.new);
          const msg = payload.new as Message;
          const isMine =
            currentUserIdRef.current != null &&
            msg.sender_id === currentUserIdRef.current;
          console.log(
            "isMine:",
            isMine,
            "pendingReplyRef.current:",
            pendingReplyRef.current
          );
          // Apply pending reply data if this is our message and we have reply metadata
          if (
            isMine &&
            pendingReplyRef.current &&
            msg.id &&
            !messageIdsRef.current.has(msg.id)
          ) {
            console.log("Applying pendingReplyRef to message:", msg.id);
            Object.assign(msg, pendingReplyRef.current);
            console.log("Message after applying reply data:", msg);
            pendingReplyRef.current = null;
          }
          const pending = pendingReceiptsRef.current[msg.id];
          const msgWithReceipts = pending
            ? {
                ...msg,
                delivered_at:
                  pending.delivered_at ?? (msg as any).delivered_at ?? null,
                read_at: pending.read_at ?? (msg as any).read_at ?? null,
              }
            : msg;
          const normalizedMsg = normalizeMessage(msgWithReceipts as Message);

          // Load translation from database if it exists
          if (msg.translation) {
            setTranslations((prev) => ({
              ...prev,
              [msg.id]: {
                translatedText: msg.translation!.translatedText,
                detectedLanguage:
                  msg.translation!.detectedLanguage || undefined,
                targetLanguage: msg.translation!.targetLanguage,
              },
            }));
          }

          shouldAutoScrollRef.current = true;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id)
              ? prev
              : sortUniqueMessages([
                  ...prev,
                  {
                    ...normalizedMsg,
                    conversation_id:
                      (msg as any).conversation_id ??
                      conversationId ??
                      undefined,
                  },
                ])
          );
        }
      );
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: any) => {
        console.log("Realtime UPDATE event:", payload.new);
        const msg = payload.new as Message;
        if (msg.deleted_at) {
          // Message was deleted
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id ? { ...m, deleted_at: msg.deleted_at } : m
            )
          );
        }
      }
    );
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_receipts",
      },
      (payload: any) => {
        const rec = (payload.new ?? payload.old) as {
          message_id?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          user_id?: string | null;
        };
        const msgId = rec?.message_id;
        if (!msgId) return;

        const applyUpdate = () => {
          let updated = false;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId) return m;
              const isMine =
                currentUserIdRef.current != null &&
                m.sender_id === currentUserIdRef.current;
              if (isMine && rec.user_id === currentUserIdRef.current) return m;
              updated = true;
              return {
                ...m,
                delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
                read_at: rec.read_at ?? m.read_at ?? null,
              };
            })
          );
          return updated;
        };

        // Try updating in-memory message regardless of cached id set
        const didUpdate = applyUpdate();
        if (didUpdate) return;

        // Otherwise, fetch the message to ensure it belongs to this conversation, then cache the receipt
        (async () => {
          try {
            const { data } = await supabase.current
              .from("messages")
              .select("id, conversation_id")
              .eq("id", msgId)
              .maybeSingle();
            if (data?.conversation_id !== conversationId) return;
            pendingReceiptsRef.current[msgId] = {
              delivered_at: rec.delivered_at ?? null,
              read_at: rec.read_at ?? null,
            };
            applyUpdate();
          } catch {
            // ignore
          }
        })();
      }
    );
    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      const rec = payload.payload as {
        user_id?: string | null;
        started?: boolean;
      };
      const uid = rec?.user_id;
      if (!uid || uid === currentUserIdRef.current) return;

      if (rec.started) {
        // User started/resumed typing
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(uid);
          return next;
        });

        // Clear any existing timeout for this user
        if (typingTimersRef.current[uid]) {
          clearTimeout(typingTimersRef.current[uid]);
        }
        // Set a timeout to remove indicator 3 seconds after this message
        typingTimersRef.current[uid] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(uid);
            return next;
          });
          delete typingTimersRef.current[uid];
        }, 3000);
      } else if (rec.started === false) {
        // User explicitly stopped typing, remove indicator immediately
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
        if (typingTimersRef.current[uid]) {
          clearTimeout(typingTimersRef.current[uid]);
          delete typingTimersRef.current[uid];
        }
      }
    });
    channel.subscribe();
    convoChannelRef.current = channel;
    return () => {
      try {
        convoChannelRef.current = null;
        if (typingSelfTimerRef.current) {
          clearTimeout(typingSelfTimerRef.current);
          typingSelfTimerRef.current = null;
        }
        Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
        typingTimersRef.current = {};
        supabase.current.removeChannel(channel);
      } catch {}
    };
  }, [conversationId]);

  // Initialize location map
  useEffect(() => {
    console.log("[LocationMap] useEffect triggered", {
      locationDrawerOpen,
      hasRef: !!locationMapRef.current,
    });

    if (!locationDrawerOpen) {
      console.log("[LocationMap] Drawer not open, skipping");
      setLocationMapReady(false); // Reset fade-in state
      return;
    }

    let mapInstance: MaplibreMap | null = null;
    let canceled = false;
    let pinElement: HTMLElement | null = null;

    const initMap = async () => {
      try {
        console.log("[LocationMap] Starting initMap");

        // Wait for the ref to be available (drawer content to mount)
        let retries = 0;
        while (!locationMapRef.current && !canceled && retries < 20) {
          console.log("[LocationMap] Waiting for ref, attempt", retries + 1);
          await new Promise((resolve) => setTimeout(resolve, 50));
          retries++;
        }

        if (!locationMapRef.current || canceled) {
          console.log("[LocationMap] Aborted - no ref or canceled", {
            hasRef: !!locationMapRef.current,
            canceled,
            retries,
          });
          return;
        }

        // Wait a bit more for drawer animation to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check container dimensions
        const rect = locationMapRef.current.getBoundingClientRect();
        console.log("[LocationMap] Container dimensions:", {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        });

        // If container has zero dimensions, it won't work
        if (rect.width === 0 || rect.height === 0) {
          console.error(
            "[LocationMap] Container has ZERO dimensions! Cannot initialize map."
          );
          console.error(
            "[LocationMap] Parent dimensions:",
            locationMapRef.current.parentElement?.getBoundingClientRect()
          );
          return;
        }

        console.log(
          "[LocationMap] Initializing location map...",
          locationMapRef.current
        );

        // Load the style (try local first, then fallback to OpenFreeMap)
        let style: string | StyleSpecification;
        try {
          console.log(
            "[LocationMap] Fetching local style from /maps/proximity-dark.json"
          );
          const res = await fetch("/maps/proximity-dark.json", {
            cache: "no-store",
          });
          console.log("[LocationMap] Fetch response:", {
            ok: res.ok,
            status: res.status,
          });
          if (res.ok) {
            style = (await res.json()) as StyleSpecification;
            console.log("[LocationMap] Loaded local map style successfully", {
              hasStyle: !!style,
              styleType: typeof style,
            });
          } else {
            style = "https://tiles.openfreemap.org/styles/positron";
            console.log(
              "[LocationMap] Local style not found, using OpenFreeMap"
            );
          }
        } catch (err) {
          console.warn(
            "[LocationMap] Failed to fetch local style, using OpenFreeMap",
            err
          );
          style = "https://tiles.openfreemap.org/styles/positron";
        }

        if (canceled) {
          console.log("[LocationMap] Canceled after style load");
          return;
        }

        // Get user location from presence context (already available from MapCanvas)
        const userPresence = presenceUserId ? presence[presenceUserId] : null;
        const userLat = userPresence?.lat;
        const userLng = userPresence?.lng;

        // Use user location if available, otherwise fallback to London
        const fallbackLat = 51.5074;
        const fallbackLng = -0.1276;
        const initialLat =
          userLat && Number.isFinite(userLat) ? userLat : fallbackLat;
        const initialLng =
          userLng && Number.isFinite(userLng) ? userLng : fallbackLng;

        console.log("[LocationMap] Using location:", {
          source: userLat && userLng ? "presence" : "fallback",
          lat: initialLat,
          lng: initialLng,
        });

        setSelectedLocation({ lat: initialLat, lng: initialLng });

        if (!locationMapRef.current || canceled) {
          console.warn("[LocationMap] Map container not available or canceled");
          return;
        }

        console.log("[LocationMap] Creating map instance with config:", {
          hasContainer: !!locationMapRef.current,
          center: [initialLng, initialLat],
          zoom: 15,
          pitch: 35,
          styleType: typeof style,
        });

        // Initialize map
        mapInstance = new maplibregl.Map({
          container: locationMapRef.current,
          style,
          center: [initialLng, initialLat],
          zoom: 15,
          pitch: 35,
          // @ts-expect-error antialias is supported by MapLibre at runtime
          antialias: true,
          attributionControl: false,
          minZoom: 15,
          maxZoom: 15,
        });

        console.log("[LocationMap] Map instance created successfully");

        // Store map instance reference for search results
        if (locationMapRef.current) {
          (locationMapRef.current as any).__mapInstance = mapInstance;
        }

        mapInstance.on("load", () => {
          console.log("[LocationMap] Map 'load' event fired");
          if (canceled) {
            console.log("[LocationMap] Canceled in load handler");
            return;
          }

          // Log map and canvas status
          const canvas = mapInstance?.getCanvas();
          const canvasContainer = mapInstance?.getCanvasContainer();
          console.log("[LocationMap] Map loaded - canvas info:", {
            hasCanvas: !!canvas,
            canvasWidth: canvas?.width,
            canvasHeight: canvas?.height,
            canvasStyle: canvas?.style.cssText,
            hasCanvasContainer: !!canvasContainer,
          });

          // Check if style has loaded
          const mapStyle = mapInstance?.getStyle();
          console.log("[LocationMap] Map style info:", {
            hasStyle: !!mapStyle,
            styleName: mapStyle?.name,
            layerCount: mapStyle?.layers?.length,
            sourceCount: Object.keys(mapStyle?.sources || {}).length,
          });

          // Resize map to ensure it has proper dimensions after drawer animation
          setTimeout(() => {
            if (mapInstance && !canceled) {
              console.log("[LocationMap] Calling resize (100ms)");
              mapInstance.resize();
              const newCanvas = mapInstance.getCanvas();
              console.log("[LocationMap] After resize:", {
                canvasWidth: newCanvas?.width,
                canvasHeight: newCanvas?.height,
              });
            }
          }, 100);

          // Additional resize after a longer delay to catch any late-rendering animations
          setTimeout(() => {
            if (mapInstance && !canceled) {
              console.log("[LocationMap] Calling resize (300ms)");
              mapInstance.resize();
              const newCanvas = mapInstance.getCanvas();
              console.log("[LocationMap] After second resize:", {
                canvasWidth: newCanvas?.width,
                canvasHeight: newCanvas?.height,
              });
            }
          }, 300);

          // Hide road numbers (like MapCanvas does)
          const hideRoadNumbers = () => {
            const layers = mapInstance?.getStyle().layers;
            if (!layers) return;
            layers.forEach((layer) => {
              if (layer.type !== "symbol" || !layer.layout) return;
              const textField = layer.layout["text-field"] as unknown;
              const hasRefToken = (field: unknown) => {
                if (typeof field === "string") return field.includes("{ref}");
                if (Array.isArray(field))
                  return JSON.stringify(field).includes('"ref"');
                return false;
              };
              if (hasRefToken(textField)) {
                mapInstance?.setLayoutProperty(layer.id, "visibility", "none");
              }
            });
          };
          hideRoadNumbers();

          // Add building extrusions
          const addBuildingExtrusions = () => {
            const BUILDING_SOURCE_ID = "openfreemap-buildings";
            if (mapInstance?.getSource(BUILDING_SOURCE_ID)) return;

            const labelLayerId = mapInstance
              ?.getStyle()
              .layers?.find(
                (layer) =>
                  layer.type === "symbol" &&
                  (layer.layout as { "text-field"?: unknown } | undefined)?.[
                    "text-field"
                  ]
              )?.id;

            mapInstance?.addSource(BUILDING_SOURCE_ID, {
              url: "https://tiles.openfreemap.org/planet",
              type: "vector",
            });

            mapInstance?.addLayer(
              {
                id: "3d-buildings",
                source: BUILDING_SOURCE_ID,
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 15,
                filter: ["!=", ["get", "hide_3d"], true],
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0,
                    "#0f1113",
                    120,
                    "#13171b",
                    300,
                    "#161b20",
                  ],
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15,
                    0,
                    16,
                    ["get", "render_height"],
                  ],
                  "fill-extrusion-base": [
                    "step",
                    ["zoom"],
                    0,
                    16,
                    ["coalesce", ["get", "render_min_height"], 0],
                  ],
                  "fill-extrusion-opacity": 0.4,
                },
              },
              labelLayerId
            );
          };
          addBuildingExtrusions();

          // Create a fixed center pin using CSS positioning (not a MapLibre marker)
          // This ensures it stays perfectly centered during zoom animations
          const pinContainer = document.createElement("div");
          pinContainer.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 32px;
            height: 32px;
            margin-left: -16px;
            margin-top: -32px;
            z-index: 10;
            pointer-events: none;
          `;

          const pinSVG = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          pinSVG.setAttribute("viewBox", "0 0 24 24");
          pinSVG.setAttribute("width", "32");
          pinSVG.setAttribute("height", "32");
          pinSVG.style.cssText = `
            filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
            color: hsl(var(--primary));
            transition: all 0.2s ease-out;
          `;
          pinSVG.innerHTML =
            '<path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';

          pinContainer.appendChild(pinSVG);

          // CRITICAL: Append to the parent of the map container, not the map container itself
          // The map container gets internal transformations during zoom, which would move the pin
          // By appending to the parent, the pin stays fixed in viewport coordinates
          locationMapRef.current?.parentElement?.appendChild(pinContainer);

          // Store reference for cleanup and visibility control
          pinElement = pinContainer;
          pinElementRef.current = pinContainer;

          // Track map movement and update selected location only (not pin position)
          const updateSelectedLocation = () => {
            if (mapInstance) {
              const center = mapInstance.getCenter();
              setSelectedLocation({ lat: center.lat, lng: center.lng });

              // If user dragged the map, clear the address input
              if (isDraggingMapRef.current) {
                setAddressInput("");
              }
            }
          };

          mapInstance!.on("move", updateSelectedLocation);
          mapInstance!.on("zoom", updateSelectedLocation);

          // Track dragging state for pin animation and address clearing
          mapInstance!.on("dragstart", () => {
            isDraggingMapRef.current = true;
            pinSVG.style.transform = "scale(1.15) translateY(-4px)";
          });

          mapInstance!.on("dragend", () => {
            pinSVG.style.transform = "scale(1) translateY(0)";
            // Reset flag after a short delay to allow updateSelectedLocation to fire
            setTimeout(() => {
              isDraggingMapRef.current = false;
            }, 100);
          });

          // Map is ready - fade it in
          setLocationMapReady(true);

          console.log("[LocationMap] Map loaded and centered on user location");
        });

        mapInstance.on("error", (err) => {
          console.error("[LocationMap] Map error event:", err);
        });

        mapInstance.on("styledata", () => {
          console.log("[LocationMap] styledata event fired");
        });

        mapInstance.on("sourcedata", (e) => {
          console.log(
            "[LocationMap] sourcedata event:",
            e.sourceId,
            e.isSourceLoaded
          );
        });

        mapInstance.on("render", () => {
          console.log("[LocationMap] render event");
        });
      } catch (error) {
        console.error("Failed to initialize location map:", error);
      }
    };

    initMap();

    return () => {
      canceled = true;
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch {
          // ignore
        }
      }
      // Clean up the pin element
      if (pinElement && pinElement.parentElement) {
        pinElement.parentElement.removeChild(pinElement);
      }
    };
  }, [locationDrawerOpen]);

  // Debounced address search using Nominatim
  useEffect(() => {
    if (!addressInput.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Don't search if we just selected an address
    if (justSelectedAddressRef.current) {
      justSelectedAddressRef.current = false;
      return;
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Show results view immediately when typing
    setShowSearchResults(true);
    setSearchingAddress(true);

    // Debounce the API call
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Nominatim bounding box for Greater London
        // South-West: 51.28, -0.51 | North-East: 51.69, 0.33
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            addressInput
          )}&limit=5&bounded=1&viewbox=-0.51,51.69,0.33,51.28`,
          {
            headers: {
              "User-Agent": "ProximityApp/1.0",
            },
          }
        );
        const data = await response.json();
        setSearchResults(data);
        setSearchingAddress(false);
      } catch (error) {
        console.error("[LocationMap] Address search error:", error);
        setSearchResults([]);
        setSearchingAddress(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [addressInput]);

  // Handle selecting a search result
  const handleSelectSearchResult = useCallback((result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // Mark that we're programmatically setting the input
      justSelectedAddressRef.current = true;

      setSelectedLocation({ lat, lng });
      setAddressInput(result.display_name);
      setShowSearchResults(false);

      // Animate map to new location with flyTo
      const mapContainer = locationMapRef.current;
      if (mapContainer && (mapContainer as any).__mapInstance) {
        const mapInstance = (mapContainer as any).__mapInstance;
        // Use easeTo instead of flyTo as zoom is locked at 15
        mapInstance.easeTo({
          center: [lng, lat],
          duration: 1500,
          easing: (t: number) => t * (2 - t), // easeOutQuad
        });
      }
    }
  }, []);

  // Hide/show pin based on search results visibility
  useEffect(() => {
    if (pinElementRef.current) {
      pinElementRef.current.style.display = showSearchResults
        ? "none"
        : "block";
    }
  }, [showSearchResults]);

  // scroll to bottom on new messages
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      shouldAutoScrollRef.current = false;
      return;
    }
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    shouldAutoScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (initialLoading) return;
    if (initialScrollDoneRef.current) return;
    if (!messages.length) return;
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "start", behavior: "auto" });
    shouldAutoScrollRef.current = false;
    initialScrollDoneRef.current = true;
  }, [initialLoading, messages]);

  useEffect(() => {
    if (typingUsers.size === 0) return;
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [typingUsers]);

  async function createContact() {
    if (contactConnectionId) {
      setContactDrawerOpen(false);
      return;
    }
    if (!otherUserId) {
      setContactError("Missing user.");
      return;
    }
    setSavingContact(true);
    setContactError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact",
          target_profile_id: otherUserId,
          nickname: contactNickname,
          whatsapp: contactWhatsApp,
          telegram: contactTelegram,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to add contact");
      }
      setContactConnectionId(body?.connection?.id ?? null);
      setContactDrawerOpen(false);
    } catch (err: any) {
      setContactError(err?.message || "Failed to add contact");
    } finally {
      setSavingContact(false);
    }
  }

  async function handlePinToggle() {
    if (!otherUserId || pinning) return;
    setPinning(true);
    try {
      if (pinConnectionId) {
        await fetch(`/api/connections/${pinConnectionId}`, {
          method: "DELETE",
        });
        setPinConnectionId(null);
      } else {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pin",
            target_profile_id: otherUserId,
            nickname: participantName,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to pin profile");
        }
        setPinConnectionId(body?.connection?.id ?? null);
      }
    } catch {
      // ignore errors for now
    } finally {
      setPinning(false);
    }
  }

  // Load connection status for this participant
  useEffect(() => {
    if (!otherUserId) return;
    setLoadingConnections(true);
    fetch(`/api/connections`)
      .then((res) => res.json())
      .then((body) => {
        const list = body?.connections ?? [];
        const contact = list.find((c: any) => {
          if (c.type !== "contact") return false;
          const rows = Array.isArray(c.connection_contacts)
            ? c.connection_contacts
            : [c.connection_contacts].filter(Boolean);
          return rows.some((r: any) => {
            const candidate =
              r?.profile_id ??
              r?.profiles?.id ??
              c.target_profile_id ??
              c.profile_id;
            return candidate === otherUserId;
          });
        });
        const pin = list.find((c: any) => {
          if (c.type !== "pin") return false;
          const rows = Array.isArray(c.connection_pins)
            ? c.connection_pins
            : [c.connection_pins].filter(Boolean);
          return rows.some((r: any) => {
            const candidate =
              r?.pinned_profile_id ??
              r?.pinned_profile?.id ??
              c.target_profile_id ??
              c.pinned_profile_id;
            return candidate === otherUserId;
          });
        });
        setContactConnectionId(contact?.id ?? null);
        setPinConnectionId(pin?.id ?? null);
        if (contact) {
          const detail = Array.isArray(contact.connection_contacts)
            ? contact.connection_contacts[0]
            : contact.connection_contacts;
          setContactNickname(
            (prev) => detail?.display_name || prev || participantName
          );
          const meta = detail?.metadata || {};
          setContactWhatsApp(meta.whatsapp || "");
          setContactTelegram(meta.telegram || "");
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setLoadingConnections(false));
  }, [otherUserId]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !conversationId) return;
    setNewMessage("");
    console.log("handleSend - replyTarget:", replyTarget);
    const replyMeta = replyTarget
      ? {
          reply_to_id: replyTarget.id,
          reply_to_body: replyTarget.body,
          reply_to_sender_id: replyTarget.sender_id,
        }
      : { reply_to_id: null, reply_to_body: null, reply_to_sender_id: null };
    console.log("handleSend - replyMeta:", replyMeta);
    pendingReplyRef.current = replyMeta;
    console.log(
      "handleSend - pendingReplyRef.current:",
      pendingReplyRef.current
    );
    setReplyTarget(null);
    shouldAutoScrollRef.current = true;
    if (typingBroadcastedRef.current) {
      emitTyping(false);
      typingBroadcastedRef.current = false;
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
        typingSelfTimerRef.current = null;
      }
    }
    try {
      // Detect URLs in the message
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const urls = text.match(urlRegex);

      let payload: any = { body: text, ...replyMeta };

      // If message contains exactly one URL and nothing else (or just the URL), treat it as a link message
      if (urls && urls.length === 1 && text.trim() === urls[0].trim()) {
        try {
          // Fetch link preview
          const previewRes = await fetch("/api/messages/link-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urls[0] }),
          });

          if (previewRes.ok) {
            const previewData = await previewRes.json();
            payload = {
              body: text,
              message_type: "link",
              metadata: {
                link: previewData,
              },
              ...replyMeta,
            };
          }
        } catch (previewErr) {
          console.error("Failed to fetch link preview:", previewErr);
          // Continue with regular message if preview fails
        }
      }

      console.log("Sending message with payload:", payload);
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Message API response:", data);
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // redirect if conversation missing (optional)
  useEffect(() => {
    if (!conversationId) return;
    if (!messages.length) return;
    // noop route protection; keep simple
  }, [conversationId, messages.length]);

  // Persist auto-translate languages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "autoTranslateLanguages",
        JSON.stringify(Array.from(autoTranslateLanguages))
      );
    } catch (err) {
      console.error("Failed to save auto-translate state:", err);
    }
  }, [autoTranslateLanguages]);

  // Initialize pre-existing messages for languages loaded from localStorage
  useEffect(() => {
    if (messages.length === 0) return;

    // For each enabled language that doesn't have pre-existing tracking yet,
    // record all current messages as pre-existing
    autoTranslateLanguages.forEach((lang) => {
      if (!preExistingMessagesRef.current[lang]) {
        preExistingMessagesRef.current[lang] = new Set(
          messages.map((m) => m.id)
        );
        console.log(
          "[Auto-translate] Initialized pre-existing tracking for",
          lang,
          "with",
          messages.length,
          "messages"
        );
      }
    });
  }, [messages.length, autoTranslateLanguages]);

  // Auto-translate new messages in enabled languages
  useEffect(() => {
    if (autoTranslateLanguages.size === 0 || messages.length === 0) return;
    if (!currentUserId) return;
    if (modelState !== "ready") return;

    const messagesToTranslate = messages.filter(
      (m) =>
        !translations[m.id] && m.sender_id !== currentUserId && !m.deleted_at
    );

    if (messagesToTranslate.length === 0) return;

    console.log(
      "[Auto-translate] Checking",
      messagesToTranslate.length,
      "messages, enabled:",
      Array.from(autoTranslateLanguages)
    );

    const autoTranslateNewMessages = async () => {
      for (const message of messagesToTranslate) {
        try {
          const rawMsgLang = await detectLanguage(message.body);
          const msgLang = normalizeLanguage(rawMsgLang);

          // Check if this message existed before auto-translate was enabled for this language
          const preExistingIds = preExistingMessagesRef.current[msgLang];
          const isPreExisting =
            preExistingIds && preExistingIds.has(message.id);

          if (
            autoTranslateLanguages.has(msgLang) &&
            !stoppedAutoTranslateLanguages.has(msgLang) &&
            !isPreExisting // Only translate messages that arrived AFTER enabling auto-translate
          ) {
            console.log(
              "[Auto-translate] Translating",
              message.id,
              "from",
              rawMsgLang
            );
            setTranslations((prev) => ({
              ...prev,
              [message.id]: {
                translatedText: "",
                targetLanguage: "English",
                isLoading: true,
                loadingMessage: `Auto-translating ${rawMsgLang}...`,
              },
            }));

            const result = await translateText(
              message.body,
              "English",
              rawMsgLang
            );

            setTranslations((prev) => ({
              ...prev,
              [message.id]: {
                ...result,
                detectedLanguage: rawMsgLang, // Store original for display
                isLoading: false,
              },
            }));

            // Save to database
            try {
              await fetch(`/api/messages/${message.id}/translation`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  translatedText: result.translatedText,
                  detectedLanguage: msgLang,
                  targetLanguage: result.targetLanguage,
                }),
              });
            } catch (saveErr) {
              console.error("Failed to save auto-translation:", saveErr);
            }
          }
        } catch (err) {
          console.error("Auto-translation error:", err);
        }
      }
    };

    autoTranslateNewMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    messages,
    autoTranslateLanguages,
    stoppedAutoTranslateLanguages,
    translations,
    currentUserId,
    modelState, // Added to ensure we only auto-translate when model is ready
    // NOTE: detectLanguage and translateText intentionally omitted to prevent re-running when model loads
  ]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    const hasUnreadFromOthers = messages.some(
      (m) => m.sender_id !== currentUserId && !m.read_at
    );
    if (!hasUnreadFromOthers) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/messages/${conversationId}`, {
        method: "PATCH",
        signal: controller.signal,
      }).catch(() => {
        // ignore
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [conversationId, currentUserId, messages]);

  // For newly received messages, immediately upsert delivered receipts while viewing the thread
  useEffect(() => {
    if (!currentUserId || !messages.length) return;
    const now = new Date().toISOString();
    const rows = messages
      .filter(
        (m) =>
          m.sender_id !== currentUserId &&
          !m.delivered_at &&
          !deliveryAttemptRef.current.has(m.id)
      )
      .map((m) => ({
        message_id: m.id,
        user_id: currentUserId,
        delivered_at: now,
      }));
    if (!rows.length) return;
    rows.forEach((r) => deliveryAttemptRef.current.add(r.message_id));

    (async () => {
      try {
        const { error } = await supabase.current
          .from("message_receipts")
          .upsert(rows, { onConflict: "message_id,user_id" });
        if (error) return;
        const deliveredMap = rows.reduce<Record<string, string>>((acc, r) => {
          acc[r.message_id] = r.delivered_at ?? now;
          return acc;
        }, {});
        setMessages((prev) =>
          prev.map((m) =>
            deliveredMap[m.id]
              ? { ...m, delivered_at: m.delivered_at ?? deliveredMap[m.id] }
              : m
          )
        );
      } catch {
        // ignore
      }
    })();
  }, [currentUserId, messages]);

  const emitTyping = (started: boolean) => {
    if (!conversationId) return;
    const chan = convoChannelRef.current;
    if (!chan) return;
    try {
      void chan.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUserIdRef.current, started },
      });
    } catch {
      // ignore
    }
  };

  // Normalize language names for consistent comparison
  const normalizeLanguage = useCallback((lang: string): string => {
    return lang
      .toLowerCase()
      .trim()
      .replace(/\s+language$/i, "") // Remove " language" suffix
      .replace(/\s+/g, " "); // Normalize whitespace
  }, []);

  // Helper function to perform translation without cache checks
  const performTranslation = useCallback(
    async (msg: Message) => {
      try {
        // Set loading state
        setTranslations((prev) => ({
          ...prev,
          [msg.id]: {
            translatedText: "",
            targetLanguage: "English",
            isLoading: true,
            loadingMessage: "Detecting language...",
          },
        }));

        // Detect language and translate
        const rawLang = await detectLanguage(msg.body);
        const detectedLang = normalizeLanguage(rawLang);

        // Update with fun language-specific message
        setTranslations((prev) => ({
          ...prev,
          [msg.id]: {
            ...prev[msg.id],
            loadingMessage: `Learning ${rawLang}...`,
          },
        }));

        const result = await translateText(msg.body, "English", rawLang);

        const translation = {
          ...result,
          detectedLanguage: rawLang, // Store the original (capitalized) name for display
          isLoading: false,
        };

        setTranslations((prev) => ({
          ...prev,
          [msg.id]: translation,
        }));

        // Enable auto-translate for this language (using normalized name)
        setAutoTranslateLanguages((prev) => {
          const next = new Set(prev);
          if (!next.has(detectedLang)) {
            // First time enabling for this language - record all existing message IDs
            // These are messages that are already on screen when we enable auto-translate
            preExistingMessagesRef.current[detectedLang] = new Set(
              messages.map((m) => m.id)
            );
            console.log(
              "[Auto-translate] Enabled for",
              detectedLang,
              "- recorded",
              preExistingMessagesRef.current[detectedLang].size,
              "pre-existing messages"
            );
          }
          next.add(detectedLang);
          return next;
        });

        // Save translation to database
        try {
          await fetch(`/api/messages/${msg.id}/translation`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              translatedText: result.translatedText,
              detectedLanguage: detectedLang,
              targetLanguage: result.targetLanguage,
            }),
          });
        } catch (saveErr) {
          console.error("Failed to save translation to database:", saveErr);
          // Don't show error to user - translation still works in-memory
        }

        // Auto-translate other messages in the same language
        const messagesToAutoTranslate = messages.filter(
          (m) =>
            m.id !== msg.id &&
            !translations[m.id] &&
            m.sender_id !== currentUserId &&
            !m.deleted_at
        );

        for (const message of messagesToAutoTranslate) {
          try {
            const rawMsgLang = await detectLanguage(message.body);
            const msgLang = normalizeLanguage(rawMsgLang);
            if (
              msgLang === detectedLang &&
              !stoppedAutoTranslateLanguages.has(msgLang)
            ) {
              setTranslations((prev) => ({
                ...prev,
                [message.id]: {
                  translatedText: "",
                  targetLanguage: "English",
                  isLoading: true,
                  loadingMessage: `Translating ${rawMsgLang}...`,
                },
              }));

              const autoResult = await translateText(
                message.body,
                "English",
                rawMsgLang
              );

              setTranslations((prev) => ({
                ...prev,
                [message.id]: {
                  ...autoResult,
                  detectedLanguage: rawMsgLang, // Store original for display
                  isLoading: false,
                },
              }));

              // Save auto-translation to database
              try {
                await fetch(`/api/messages/${message.id}/translation`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    translatedText: autoResult.translatedText,
                    detectedLanguage: msgLang,
                    targetLanguage: autoResult.targetLanguage,
                  }),
                });
              } catch (saveErr) {
                console.error("Failed to save auto-translation:", saveErr);
              }
            }
          } catch (err) {
            console.error(
              "Auto-translation error for message:",
              message.id,
              err
            );
          }
        }
      } catch (err) {
        console.error("Translation error:", err);
        setTranslations((prev) => ({
          ...prev,
          [msg.id]: {
            translatedText: "",
            targetLanguage: "English",
            isLoading: false,
            error: "Failed to translate message",
          },
        }));
        toast.error("Translation failed");
      }
    },
    [
      detectLanguage,
      translateText,
      normalizeLanguage,
      messages,
      translations,
      currentUserId,
      stoppedAutoTranslateLanguages,
    ]
  );

  const handleMessageAction = useCallback(
    async (
      action: "reply" | "copy" | "info" | "translate" | "delete",
      msg?: Message
    ) => {
      console.log("handleMessageAction called:", { action, msg });
      if (action === "copy" && msg?.body) {
        const didCopy = await copyToClipboard(msg.body);
        if (didCopy) {
          toast.success("Message copied to clipboard");
          setCopiedMessageId(msg.id);
          if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
          }
          copiedTimerRef.current = setTimeout(() => {
            setCopiedMessageId(null);
            copiedTimerRef.current = null;
          }, 1500);
        } else {
          toast.error("Failed to copy message");
        }
      } else if (action === "reply" && msg) {
        console.log("Setting replyTarget to:", msg);
        setReplyTarget(msg);
      } else if (action === "info" && msg) {
        setInfoMessage(msg);
        setInfoDrawerOpen(true);
      } else if (action === "translate" && msg) {
        // Translation feature disabled for now
        toast.info("Translation feature coming soon");
      } else if (action === "delete" && msg) {
        try {
          console.log(
            "Deleting message:",
            msg.id,
            "from conversation:",
            conversationId
          );
          const res = await fetch(`/api/messages/${conversationId}/${msg.id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          console.log("Delete response:", res.status, data);
          if (res.ok) {
            toast.success("Message deleted");
          } else {
            toast.error(data.error || "Failed to delete message");
          }
        } catch (err) {
          console.error("Delete message error:", err);
          toast.error("Failed to delete message");
        }
      }
      // TODO: wire if needed
      setFocusedMessageId(null);
      setFocusedMessageRect(null);
    },
    [
      conversationId,
      copyToClipboard,
      checkModelCached,
      modelState,
      initializeModel,
      performTranslation,
    ]
  );

  const handleReactionToggle = useCallback(
    async (message: Message, type: string) => {
      const convId = message.conversation_id ?? conversationId;
      if (!convId) {
        showReactionError("Missing conversation id; cannot send reaction.");
        return;
      }
      const actorId = currentUserIdRef.current ?? currentUserId;
      if (!actorId) {
        showReactionError("Not authenticated; please re-login.");
        return;
      }
      const prev = message.my_reaction ?? null;
      const next = prev === type ? null : type;
      setReactionTargetId(null);
      setFocusedMessageId(null);
      setFocusedMessageRect(null);

      // Trigger floating animation when adding a reaction (not removing)
      if (next !== null) {
        const animationId = `${message.id}-${type}-${Date.now()}`;
        setFloatingReactions((prevReactions) => [
          ...prevReactions,
          {
            id: animationId,
            messageId: message.id,
            type: next,
            timestamp: Date.now(),
          },
        ]);
        // Remove after animation completes
        setTimeout(() => {
          setFloatingReactions((prevReactions) =>
            prevReactions.filter((r) => r.id !== animationId)
          );
        }, 1500);
      }

      applyReactionLocal(message.id, actorId, prev, next);
      try {
        const res = await fetch(`/api/messages/${convId}/reactions`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: message.id, type: next }),
        });
        if (!res.ok) {
          const text = await res.text();
          showReactionError(
            `Reaction failed (${res.status}): ${text || "unknown error"}`
          );
          // Revert optimistic change on failure
          applyReactionLocal(message.id, actorId, next, prev);
        }
      } catch (err) {
        showReactionError("Reaction failed: network or server error");
        applyReactionLocal(message.id, actorId, next, prev);
      }
    },
    [conversationId, currentUserId, applyReactionLocal, showReactionError]
  );

  const handleTypingChange = (value: string) => {
    setNewMessage(value);
    const hasText = value.trim().length > 0;

    if (hasText) {
      if (!typingBroadcastedRef.current) {
        emitTyping(true);
        typingBroadcastedRef.current = true;
      }
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
      }
      typingSelfTimerRef.current = setTimeout(() => {
        emitTyping(false);
        typingBroadcastedRef.current = false;
        typingSelfTimerRef.current = null;
      }, 3500);
    } else if (typingBroadcastedRef.current) {
      emitTyping(false);
      typingBroadcastedRef.current = false;
      if (typingSelfTimerRef.current) {
        clearTimeout(typingSelfTimerRef.current);
        typingSelfTimerRef.current = null;
      }
    }
  };

  const loadOlder = useCallback(async () => {
    if (
      !conversationId ||
      loadingOlderRef.current ||
      loadingOlder ||
      !hasMore ||
      !messages.length
    )
      return;
    const earliest = messages[0];
    if (!earliest) return;
    const container = listRef.current;
    pendingPrependAdjustRef.current = false;
    prevHeightRef.current = null;
    prevScrollTopRef.current = null;
    setLoadingOlder(true);
    loadingOlderRef.current = true;
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        before: earliest.created_at,
      });
      const res = await fetch(`/api/messages/${conversationId}?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load messages");
      }
      const incoming = ((data.messages as Message[]) ?? [])
        .filter((m) => !messageIdsRef.current.has(m.id))
        .map((m) =>
          normalizeMessage({
            ...m,
            conversation_id: m.conversation_id ?? conversationId ?? undefined,
          })
        );
      setHasMore(Boolean(data.hasMore));
      if (incoming.length) {
        // Load translations from database for older messages
        const translationsFromDb: Record<string, MessageTranslation> = {};
        ((data.messages as Message[]) ?? []).forEach((m) => {
          if (m.translation) {
            translationsFromDb[m.id] = {
              translatedText: m.translation.translatedText,
              detectedLanguage: m.translation.detectedLanguage || undefined,
              targetLanguage: m.translation.targetLanguage,
            };
          }
        });
        setTranslations((prev) => ({ ...prev, ...translationsFromDb }));

        prevHeightRef.current = container?.scrollHeight ?? null;
        prevScrollTopRef.current = container?.scrollTop ?? null;
        pendingPrependAdjustRef.current = true;
        setVisibleMessages((prev) => {
          const next = new Set(prev);
          incoming.forEach((m) => next.add(m.id));
          return next;
        });
        setMessages((prev) => sortUniqueMessages([...incoming, ...prev]));
      } else {
        pendingPrependAdjustRef.current = false;
        prevHeightRef.current = null;
        prevScrollTopRef.current = null;
      }
    } catch {
      pendingPrependAdjustRef.current = false;
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    } finally {
      if (!pendingPrependAdjustRef.current) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
        prevHeightRef.current = null;
        prevScrollTopRef.current = null;
      }
    }
  }, [conversationId, hasMore, loadingOlder, messages]);

  useLayoutEffect(() => {
    if (!pendingPrependAdjustRef.current) return;
    const el = listRef.current;
    const before = prevHeightRef.current;
    const beforeScroll = prevScrollTopRef.current;
    if (!el || before == null || beforeScroll == null) {
      pendingPrependAdjustRef.current = false;
      loadingOlderRef.current = false;
      setLoadingOlder(false);
      prevHeightRef.current = null;
      prevScrollTopRef.current = null;
      return;
    }
    const after = el.scrollHeight;
    el.scrollTop = beforeScroll + (after - before);
    pendingPrependAdjustRef.current = false;
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    prevHeightRef.current = null;
    prevScrollTopRef.current = null;
  }, [messages]);

  const hasText = newMessage.trim().length > 0;
  const receiptIdsKey = useMemo(() => {
    return messages
      .map((m) => m.id)
      .filter(Boolean)
      .sort()
      .join(",");
  }, [messages]);
  const displayName = (contactNickname?.trim() || participantName || "").trim();
  const secondaryName =
    contactNickname?.trim() && participantProfileTitle
      ? participantProfileTitle
      : participantProfileTitle && participantProfileTitle !== displayName
      ? participantProfileTitle
      : null;

  useEffect(() => {
    if (!conversationId) return;
    const ids = Array.from(messageIdsRef.current);
    if (!ids.length) return;

    const filter = `message_id=in.(${ids.map((id) => `"${id}"`).join(",")})`;

    const channel = supabase.current.channel(
      `receipts:${conversationId}:${ids.length}`
    );

    const handleReceipt = (payload: any) => {
      const rec = (payload.new ?? payload.old) as {
        message_id?: string;
        delivered_at?: string | null;
        read_at?: string | null;
        user_id?: string | null;
      };
      const msgId = rec?.message_id;
      if (!msgId) return;

      let updated = false;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const isMine =
            currentUserIdRef.current != null &&
            m.sender_id === currentUserIdRef.current;
          if (isMine && rec.user_id === currentUserIdRef.current) return m;
          updated = true;
          return {
            ...m,
            delivered_at: rec.delivered_at ?? m.delivered_at ?? null,
            read_at: rec.read_at ?? m.read_at ?? null,
          };
        })
      );
      if (updated) return;
      pendingReceiptsRef.current[msgId] = {
        delivered_at: rec.delivered_at ?? null,
        read_at: rec.read_at ?? null,
      };
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_receipts", filter },
      handleReceipt
    );
    channel.subscribe();
    receiptsChannelRef.current = channel;

    return () => {
      try {
        if (receiptsChannelRef.current) {
          supabase.current.removeChannel(receiptsChannelRef.current);
        }
      } catch {}
      receiptsChannelRef.current = null;
    };
  }, [conversationId, receiptIdsKey]);

  useEffect(() => {
    if (!conversationId) return;
    const ids = Array.from(messageIdsRef.current);
    if (!ids.length) return;

    const filter = `message_id=in.(${ids.map((id) => `"${id}"`).join(",")})`;

    const channel = supabase.current.channel(
      `reactions:${conversationId}:${ids.length}`
    );

    const handleReaction = (payload: any) => {
      console.log("Reaction realtime payload:", payload);
      const recNew = payload.new ?? {};
      const recOld = payload.old ?? {};
      const msgId =
        (recNew as any).message_id ?? (recOld as any).message_id ?? null;
      if (!msgId) return;
      const prevType = (recOld as any).type ?? null;
      const nextType = (recNew as any).type ?? null;
      const actorUserId =
        (recNew as any).user_id ?? (recOld as any).user_id ?? null;
      // Ignore own realtime event; optimistic update already applied
      if (actorUserId && actorUserId === currentUserIdRef.current) {
        console.log("Ignoring own reaction event");
        return;
      }
      console.log("Applying reaction update:", {
        msgId,
        prevType,
        nextType,
        actorUserId,
      });
      applyReactionLocal(msgId, actorUserId, prevType, nextType);
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions", filter },
      handleReaction
    );
    channel.subscribe();
    reactionsChannelRef.current = channel;

    return () => {
      try {
        if (reactionsChannelRef.current) {
          supabase.current.removeChannel(reactionsChannelRef.current);
        }
      } catch {}
      reactionsChannelRef.current = null;
    };
  }, [conversationId, receiptIdsKey, applyReactionLocal]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => {
      cancelLongPress();
      setReactionTargetId(null);
      if (!hasMore || loadingOlder || loadingOlderRef.current) return;
      // Trigger when within ~5 messages from top; using a px threshold approximating a few message heights
      if (el.scrollTop <= 120) {
        void loadOlder();
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingOlder, loadOlder, messages.length, cancelLongPress]);

  // Calculate the latest translated message for each language
  const latestTranslatedMessageByLanguage = useMemo(() => {
    const latest: Record<string, string> = {}; // language -> message id

    // Iterate in reverse (latest messages first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const translation = translations[m.id];

      if (
        translation?.detectedLanguage &&
        !latest[translation.detectedLanguage]
      ) {
        latest[translation.detectedLanguage] = m.id;
      }
    }

    return latest;
  }, [messages, translations]);

  return (
    <div className="h-svh min-h-svh bg-background text-foreground flex flex-col">
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120px) scale(1);
            opacity: 0;
          }
        }
        @keyframes fadeOut {
          0% {
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
      {focusedMessageId && (
        <div
          className="fixed inset-0 z-40 transition-all duration-300"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => {
            setReactionTargetId(null);
            setFocusedMessageId(null);
            setFocusedMessageRect(null);
          }}
        />
      )}
      <div className="bg-background/60 supports-backdrop-filter:bg-background/50 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-3 border-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Back"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {initialLoading ? (
              <>
                <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                <div className="leading-tight space-y-1">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted/80 animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    alt={participantName}
                    src={participantAvatar ?? undefined}
                  />
                  <AvatarFallback>{participantInitials}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-medium flex items-center gap-1 max-w-60">
                    <span className="truncate">{displayName || "Contact"}</span>
                    {secondaryName ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {secondaryName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-green-500" />
                    <span>Online</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Conversation actions"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <UserRound className="h-4 w-4" />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loadingConnections && !contactConnectionId}
              onSelect={(e) => {
                e.preventDefault();
                if (contactConnectionId) {
                  router.push(`/app/connections/${contactConnectionId}`);
                  return;
                }
                setContactDrawerOpen(true);
                if (!contactNickname && participantName) {
                  setContactNickname(participantName);
                }
              }}
            >
              <UserPlus className="h-4 w-4" />
              {contactConnectionId ? "View contact" : "Add contact"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={
                loadingConnections ||
                pinning ||
                !otherUserId ||
                (Boolean(contactConnectionId) && !pinConnectionId)
              }
              onSelect={(e) => {
                e.preventDefault();
                void handlePinToggle();
              }}
            >
              <Pin className="h-4 w-4" />
              {pinConnectionId ? "Unpin profile" : "Pin profile"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Shield className="h-4 w-4" />
              Block contact
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <Flag className="h-4 w-4" />
              Report user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {reactionError ? (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-destructive/30">
          {reactionError}
        </div>
      ) : null}
      <div
        ref={listRef}
        className={`relative flex-1 px-4 pt-4 space-y-3 ${
          focusedMessageId ? "overflow-hidden touch-none" : "overflow-y-auto"
        } select-none ${
          typingUsers.size > 0 ? "pb-10" : "pb-2"
        } [&::-webkit-scrollbar]:hidden`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onWheelCapture={(e) => {
          if (focusedMessageId) e.preventDefault();
        }}
        onTouchMove={(e) => {
          if (focusedMessageId) e.preventDefault();
        }}
        onScroll={(e) => {
          if (focusedMessageId) {
            e.preventDefault();
            const el = e.currentTarget;
            el.scrollTop = el.scrollTop;
          }
        }}
      >
        {copiedMessageId ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="rounded-xl bg-card px-4 py-2 text-sm text-foreground shadow-lg border">
              Copied message
            </div>
          </div>
        ) : null}
        {initialLoading && messages.length === 0
          ? Array.from({ length: 6 }).map((_, idx) => {
              const isMe = idx % 2 === 0;
              return (
                <div
                  key={`skeleton-${idx}`}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[70%] ${
                      isMe
                        ? "bg-primary/30 text-white rounded-br-none"
                        : "bg-muted text-muted-foreground rounded-bl-none"
                    } animate-pulse space-y-2`}
                  >
                    <div className="h-3 w-32 rounded bg-foreground/20" />
                    <div className="h-3 w-20 rounded bg-foreground/10" />
                  </div>
                </div>
              );
            })
          : null}
        {messages.map((m) => {
          const isMe =
            currentUserId != null ? m.sender_id === currentUserId : false;
          const isVisible = visibleMessages.has(m.id);
          const reactionEntries = Object.entries(
            m.reaction_counts || {}
          ).filter(([, count]) => (count ?? 0) > 0);
          const totalReactions = reactionEntries.reduce(
            (sum, [, count]) => sum + (count ?? 0),
            0
          );
          const showPicker = reactionTargetId === m.id;
          const isFocused = focusedMessageId === m.id;
          const myReaction = m.my_reaction ?? null;

          // Calculate centered position when focused
          const messageStyle: React.CSSProperties = {};
          if (isFocused && focusedMessageRect) {
            const viewportHeight = window.innerHeight;
            const viewportCenterY = viewportHeight / 2;
            const messageHeight = focusedMessageRect.height;
            const targetTop = viewportCenterY - messageHeight / 2;
            const translateY = targetTop - focusedMessageRect.top;

            Object.assign(messageStyle, {
              transform: `translateY(${translateY}px)`,
              zIndex: 50,
              transition: "transform 300ms ease-out",
            });
          }

          const reactionChip = reactionEntries.length ? (
            <div
              className="inline-flex items-center gap-1 rounded-full bg-transparent px-0 py-0 text-[12px] text-current"
              onClick={(e) => {
                e.stopPropagation();
                setReactionTargetId(m.id);
              }}
            >
              {reactionEntries.map(([type]) => {
                const meta = reactionMeta[type];
                const fallback = meta?.emoji ?? "★";
                return (
                  <span key={type} className="inline-flex items-center gap-1">
                    <AnimatedEmoji
                      src={meta?.src ?? ""}
                      fallback={fallback}
                      size={18}
                      playOnce
                      restAtEnd
                      restFrameFraction={meta?.restFrameFraction}
                    />
                  </span>
                );
              })}
              {totalReactions > 1 ? (
                <span className="ml-0.5 text-xs font-semibold">
                  {totalReactions}
                </span>
              ) : null}
            </div>
          ) : null;
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageElsRef.current[m.id] = el;
              }}
              className={`relative flex ${
                isMe ? "justify-end" : "justify-start"
              } ${!isFocused ? "transition-all duration-300 ease-out" : ""} ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1"
              }`}
              style={isFocused ? messageStyle : undefined}
              data-message-id={m.id}
            >
              {showPicker && (
                <>
                  <div
                    className={`absolute top-0 z-50 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                    ref={reactionMenuRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{ transform: "translateY(calc(-100% - 8px))" }}
                  >
                    <div className="flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg backdrop-blur pointer-events-auto">
                      {REACTIONS.map((r, idx) => {
                        const isActive = myReaction === r.type;
                        return (
                          <div
                            key={r.type}
                            role="button"
                            tabIndex={0}
                            className={`p-2 text-xl leading-none rounded-full transition pointer-events-auto ${
                              isActive ? "bg-muted" : "hover:bg-muted"
                            }`}
                            data-reaction={r.type}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleReactionToggle(m, r.type);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleReactionToggle(m, r.type);
                            }}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleReactionToggle(m, r.type);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleReactionToggle(m, r.type);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleReactionToggle(m, r.type);
                              }
                            }}
                          >
                            <AnimatedEmoji
                              src={r.src}
                              fallback={r.emoji}
                              size={20}
                              delayMs={idx * 80}
                              playOnce
                              restAtEnd
                              restFrameFraction={r.restFrameFraction}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    className={`absolute bottom-0 z-50 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                    ref={actionMenuRef}
                    style={{ transform: "translateY(calc(100% + 8px))" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="rounded-lg border bg-background/95 shadow-lg backdrop-blur min-w-[180px]">
                      <div className="py-1">
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(
                              "Reply button clicked for message:",
                              m.id
                            );
                            handleMessageAction("reply", m);
                            setReactionTargetId(null);
                          }}
                        >
                          <Reply className="h-4 w-4" />
                          Reply
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageAction("copy", m);
                            setReactionTargetId(null);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Copy message
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageAction("translate", m);
                            setReactionTargetId(null);
                          }}
                        >
                          <Languages className="h-4 w-4" />
                          Translate
                        </button>
                        {isMe && (
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageAction("info", m);
                              setReactionTargetId(null);
                            }}
                          >
                            <Info className="h-4 w-4" />
                            Info
                          </button>
                        )}
                        {isMe && (
                          <div className="my-1 border-t border-border" />
                        )}
                        {isMe && (
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageAction("delete", m);
                              setReactionTargetId(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {floatingReactions
                .filter((fr) => fr.messageId === m.id)
                .map((fr) => {
                  const meta = reactionMeta[fr.type];
                  const fallback = meta?.emoji ?? "★";
                  return (
                    <div
                      key={fr.id}
                      className="absolute pointer-events-none z-30"
                      style={{
                        left: isMe ? "auto" : "50%",
                        right: isMe ? "50%" : "auto",
                        bottom: "20%",
                        animation: "floatUp 1.5s ease-out forwards",
                      }}
                    >
                      <div
                        style={{
                          animation: "fadeOut 1.5s ease-out forwards",
                          transform: "scale(1.5)",
                        }}
                      >
                        <AnimatedEmoji
                          src={meta?.src ?? ""}
                          fallback={fallback}
                          size={48}
                          playOnce
                          restAtEnd
                          restFrameFraction={meta?.restFrameFraction}
                        />
                      </div>
                    </div>
                  );
                })}
              {m.deleted_at ? (
                <div
                  className={`text-sm italic text-muted-foreground px-3 py-2 ${
                    isMe ? "text-right" : "text-left"
                  }`}
                >
                  Message deleted
                </div>
              ) : (
                <div
                  className={`relative rounded-lg ${
                    m.message_type === "location" || m.message_type === "link"
                      ? "p-2 w-[75%] sm:w-[65%] lg:w-[55%]"
                      : "px-3 py-2 max-w-[75%] sm:max-w-[65%] lg:max-w-[55%]"
                  } ${
                    isMe
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  } transition-all duration-300 ease-out overflow-hidden pointer-events-auto`}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    startLongPress(m.id);
                  }}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(m.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setReactionTargetId(m.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    void handleReactionToggle(m, "heart");
                  }}
                >
                  {m.reply_to_id && m.reply_to_body ? (
                    <div
                      className={`mb-2 rounded px-2 py-1.5 border-l-2 ${
                        isMe
                          ? "bg-white/20 border-white/40"
                          : "bg-black/10 border-black/30"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-semibold mb-0.5 ${
                          isMe ? "text-white/90" : "text-foreground/80"
                        }`}
                      >
                        {m.reply_to_sender_id === currentUserId
                          ? "You"
                          : participantName || "Them"}
                      </div>
                      <div
                        className={`text-xs line-clamp-2 ${
                          isMe ? "text-white/80" : "text-foreground/70"
                        }`}
                      >
                        {m.reply_to_body}
                      </div>
                    </div>
                  ) : null}

                  {/* Link message content */}
                  {m.message_type === "link" && m.metadata?.link ? (
                    <div className="w-full">
                      <LinkPreview
                        link={m.metadata.link}
                        onClick={() => {
                          if (m.metadata?.link?.url) {
                            setViewingLinkUrl(m.metadata.link.url);
                            setLinkViewerDrawerOpen(true);
                          }
                        }}
                        isMe={isMe}
                      />
                    </div>
                  ) : /* Location message content */
                  m.message_type === "location" && m.metadata?.location ? (
                    <div className="space-y-2 w-full">
                      {/* Static map preview */}
                      <StaticMapPreview
                        location={{
                          lat: m.metadata.location.lat,
                          lng: m.metadata.location.lng,
                        }}
                        onClick={() => {
                          if (m.metadata?.location) {
                            setViewingLocation({
                              lat: m.metadata.location.lat,
                              lng: m.metadata.location.lng,
                              address: m.metadata.location.address,
                            });
                            setViewLocationModalOpen(true);
                          }
                        }}
                      />
                      {/* Address text */}
                      {m.metadata.location.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {m.metadata.location.address}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed wrap-break-word">
                      {m.body}
                    </p>
                  )}

                  {translations[m.id] && (
                    <div
                      className={`mt-2 pt-2 border-t ${
                        isMe ? "border-white/20" : "border-black/20"
                      }`}
                    >
                      {translations[m.id].isLoading ? (
                        <div
                          className={`text-xs ${
                            isMe ? "text-white/70" : "text-foreground/60"
                          }`}
                        >
                          {modelState === "loading" && loadingProgress.text ? (
                            <div className="flex items-center gap-2">
                              <span className="italic">
                                {loadingProgress.text}
                              </span>
                              {loadingProgress.progress > 0 && (
                                <span className="font-semibold">
                                  {loadingProgress.progress}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic">
                              {translations[m.id].loadingMessage ||
                                "Translating..."}
                            </span>
                          )}
                        </div>
                      ) : translations[m.id].error ? (
                        <div
                          className={`text-xs italic ${
                            isMe ? "text-red-200" : "text-red-600"
                          }`}
                        >
                          {translations[m.id].error}
                        </div>
                      ) : (
                        <>
                          <div
                            className={`flex items-center justify-between gap-2 mb-1`}
                          >
                            <div
                              className={`text-[10px] font-semibold ${
                                isMe ? "text-white/70" : "text-foreground/60"
                              }`}
                            >
                              {translations[m.id].detectedLanguage
                                ? `Translated from ${
                                    translations[m.id].detectedLanguage
                                  }`
                                : "Translation"}
                            </div>
                            {translations[m.id].detectedLanguage &&
                              (() => {
                                const normalizedLang = normalizeLanguage(
                                  translations[m.id].detectedLanguage!
                                );
                                return (
                                  autoTranslateLanguages.has(normalizedLang) &&
                                  latestTranslatedMessageByLanguage[
                                    translations[m.id].detectedLanguage!
                                  ] === m.id
                                );
                              })() && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rawLang =
                                      translations[m.id].detectedLanguage;
                                    if (rawLang) {
                                      const normalizedLang =
                                        normalizeLanguage(rawLang);
                                      setStoppedAutoTranslateLanguages(
                                        (prev) => {
                                          const next = new Set(prev);
                                          next.add(normalizedLang);
                                          return next;
                                        }
                                      );
                                      setAutoTranslateLanguages((prev) => {
                                        const next = new Set(prev);
                                        next.delete(normalizedLang);
                                        return next;
                                      });
                                      toast.success(
                                        `Stopped auto-translating ${rawLang}`
                                      );
                                    }
                                  }}
                                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                                    isMe
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-black/10 hover:bg-black/20 text-foreground/70"
                                  }`}
                                >
                                  Stop auto-translate
                                </button>
                              )}
                          </div>
                          <p
                            className={`text-sm leading-relaxed wrap-break-word ${
                              isMe ? "text-white/90" : "text-foreground/90"
                            }`}
                          >
                            {translations[m.id].translatedText}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <div
                    className={`mt-1 text-xs flex items-center gap-2 ${
                      isMe ? "text-blue-100" : "text-muted-foreground"
                    }`}
                    style={{
                      justifyContent: isMe ? "space-between" : "space-between",
                    }}
                  >
                    {isMe ? (
                      <>
                        <div className="flex-1 flex items-center gap-1">
                          {reactionChip}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>
                            {new Date(m.created_at).toLocaleTimeString(
                              undefined,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              }
                            )}
                          </span>
                          {m.read_at ? (
                            <CheckCheck className="h-3.5 w-3.5 text-white" />
                          ) : m.delivered_at ? (
                            <div className="flex gap-0.5">
                              <Check className="h-3.5 w-3.5 text-white/70" />
                              <Check className="h-3.5 w-3.5 text-white/70" />
                            </div>
                          ) : (
                            <Check className="h-3.5 w-3.5 text-white/70" />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <span>
                            {new Date(m.created_at).toLocaleTimeString(
                              undefined,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              }
                            )}
                          </span>
                        </div>
                        {reactionChip}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {typingUsers.size > 0 ? (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none px-3 py-2 bg-muted text-foreground inline-flex items-center gap-1 shadow-sm">
              <span className="sr-only">Typing...</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-foreground/70 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={endRef} style={{ height: 0 }} />
      </div>
      <div className="bg-card/80 backdrop-blur px-3 py-2">
        {replyTarget ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs shadow-sm border-l-2 border-primary">
            <div className="flex-1 min-w-0">
              <div className="text-primary font-medium mb-0.5">
                Replying to{" "}
                {replyTarget.sender_id === currentUserId
                  ? "yourself"
                  : participantName || "them"}
              </div>
              <div className="line-clamp-2 text-foreground/70">
                {replyTarget.body}
              </div>
            </div>
            <button
              className="shrink-0 text-foreground/60 hover:text-foreground transition-colors p-1"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <InputGroup
          className="w-full border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 **:data-[slot=input-group-control]:bg-transparent **:data-[slot=input-group-control]:shadow-none **:data-[slot=input-group-control]:border-0"
          style={{ background: "transparent" }}
        >
          <InputGroupAddon align="inline-start" className="pl-1">
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              className="rounded-full bg-muted text-foreground hover:bg-muted/80"
              aria-label="Add"
              onClick={() => setSendDrawerOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </InputGroupButton>
          </InputGroupAddon>

          <InputGroupTextarea
            value={newMessage}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onBlur={() => {
              if (typingBroadcastedRef.current) {
                emitTyping(false);
                typingBroadcastedRef.current = false;
              }
              if (typingSelfTimerRef.current) {
                clearTimeout(typingSelfTimerRef.current);
                typingSelfTimerRef.current = null;
              }
            }}
            placeholder="Write a message..."
            minRows={1}
            maxRows={6}
            className="text-base min-h-0 py-1.5 border-0 bg-transparent shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
          />

          <InputGroupAddon align="inline-end" className="pr-1">
            <InputGroupButton
              size="icon-sm"
              variant="default"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Send"
              disabled={!hasText}
              onClick={handleSend}
            >
              <ArrowUp className="h-4 w-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Contact drawer */}
      <Drawer open={contactDrawerOpen} onOpenChange={setContactDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {contactConnectionId ? "View contact" : "Add contact"}
            </DrawerTitle>
            <DrawerDescription>
              Save their details so you can find them later.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-5">
            <div className="space-y-2">
              <Label htmlFor="contact-nickname">Nickname</Label>
              <Input
                id="contact-nickname"
                value={contactNickname}
                onChange={(e) => setContactNickname(e.target.value)}
                placeholder={participantName || "Nickname"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-whatsapp">WhatsApp</Label>
              <Input
                id="contact-whatsapp"
                value={contactWhatsApp}
                onChange={(e) => setContactWhatsApp(e.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-telegram">Telegram</Label>
              <Input
                id="contact-telegram"
                value={contactTelegram}
                onChange={(e) => setContactTelegram(e.target.value)}
                placeholder="@username"
              />
            </div>
            {contactError ? (
              <p className="text-sm text-destructive">{contactError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setContactDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void createContact()}
                disabled={savingContact || !otherUserId}
              >
                {savingContact
                  ? "Saving..."
                  : contactConnectionId
                  ? "Update"
                  : "Save contact"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Send drawer */}
      <Drawer open={sendDrawerOpen} onOpenChange={setSendDrawerOpen}>
        <DrawerContent className="pb-2">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Send</DrawerTitle>
          </DrawerHeader>

          {/* Recently used section */}
          <div className="px-4 pb-4">
            <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
              Recently used
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="shrink-0 w-20 h-20 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 px-4 pb-5">
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={handlePhotoSelect}
            >
              <Image className="h-5 w-5 text-foreground" />
              <span>Photo</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={() => setAlbumDrawerOpen(true)}
            >
              <BookOpen className="h-5 w-5 text-foreground" />
              <span>Album</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={() => setLocationDrawerOpen(true)}
            >
              <MapPin className="h-5 w-5 text-foreground" />
              <span>Location</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={() => setSendDrawerOpen(false)}
            >
              <UsersRound className="h-5 w-5 text-foreground" />
              <span>Profile</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={() => setSendDrawerOpen(false)}
            >
              <Calendar className="h-5 w-5 text-foreground" />
              <span>Event</span>
            </div>
            <div
              className="flex flex-col items-center gap-2 rounded-2xl bg-muted/20 p-4 text-xs font-semibold text-foreground transition hover:bg-muted/30 cursor-pointer"
              onClick={() => setSendDrawerOpen(false)}
            >
              <UserRound className="h-5 w-5 text-foreground" />
              <span>Contact</span>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Album drawer */}
      <Drawer open={albumDrawerOpen} onOpenChange={setAlbumDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Send album</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-5">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="shrink-0 w-24 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setAlbumDrawerOpen(false)}
                >
                  <div className="w-24 h-24 rounded-lg bg-muted/30 flex items-center justify-center mb-2">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium truncate">Album {i}</p>
                </div>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Location drawer */}
      <Drawer open={locationDrawerOpen} onOpenChange={setLocationDrawerOpen}>
        <DrawerContent className="flex flex-col p-0" style={{ height: "85vh" }}>
          <DrawerHeader className="px-4 pb-3 shrink-0">
            <DrawerTitle>Send location</DrawerTitle>
          </DrawerHeader>
          <div className="relative flex-1 min-h-0">
            {/* Map - full width, no border */}
            <div
              ref={locationMapRef}
              className="absolute inset-0 touch-none transition-opacity duration-500"
              style={{
                width: "100%",
                height: "100%",
                zIndex: 1,
                opacity: locationMapReady && !showSearchResults ? 1 : 0,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            />

            {/* Search results list */}
            <div
              className="absolute inset-0 bg-background transition-opacity duration-500"
              style={{
                zIndex: 2,
                opacity: showSearchResults ? 1 : 0,
                pointerEvents: showSearchResults ? "auto" : "none",
              }}
            >
              <ScrollArea className="h-full [&>div]:overflow-y-auto! [&>div]:scrollbar-hide">
                <div className="px-4 pt-20 pb-32 space-y-2">
                  {searchingAddress ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-start gap-3 p-3">
                          <Skeleton className="h-4 w-4 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No results found
                    </div>
                  ) : (
                    (() => {
                      // Dedupe results by display_name
                      const uniqueResults = searchResults.filter(
                        (result, index, self) =>
                          index ===
                          self.findIndex(
                            (r) => r.display_name === result.display_name
                          )
                      );

                      return uniqueResults.map((result, index) => {
                        // Clean up address - remove England, United Kingdom, Greater London, and borough names
                        let cleanAddress = result.display_name
                          .replace(/, England/gi, "")
                          .replace(/, United Kingdom/gi, "")
                          .replace(/, Greater London/gi, "");

                        // Remove borough names (common London boroughs)
                        const boroughs = [
                          "Westminster",
                          "Camden",
                          "Islington",
                          "Hackney",
                          "Tower Hamlets",
                          "Greenwich",
                          "Lewisham",
                          "Southwark",
                          "Lambeth",
                          "Wandsworth",
                          "Hammersmith and Fulham",
                          "Kensington and Chelsea",
                          "Brent",
                          "Ealing",
                          "Hounslow",
                          "Richmond upon Thames",
                          "Kingston upon Thames",
                          "Merton",
                          "Sutton",
                          "Croydon",
                          "Bromley",
                          "Bexley",
                          "Havering",
                          "Barking and Dagenham",
                          "Redbridge",
                          "Newham",
                          "Waltham Forest",
                          "Haringey",
                          "Enfield",
                          "Barnet",
                          "Harrow",
                          "Hillingdon",
                        ];
                        boroughs.forEach((borough) => {
                          cleanAddress = cleanAddress.replace(
                            new RegExp(`, ${borough}`, "gi"),
                            ""
                          );
                        });

                        // Get icon based on type
                        const getTypeIcon = (type: string) => {
                          const iconMap: Record<string, React.ReactNode> = {
                            house: <Home className="h-4 w-4" />,
                            apartment: <Building2 className="h-4 w-4" />,
                            building: <Building className="h-4 w-4" />,
                            university: <GraduationCap className="h-4 w-4" />,
                            school: <School className="h-4 w-4" />,
                            hospital: <Hospital className="h-4 w-4" />,
                            reservoir: <Droplet className="h-4 w-4" />,
                            park: <Trees className="h-4 w-4" />,
                            restaurant: <UtensilsCrossed className="h-4 w-4" />,
                            cafe: <Coffee className="h-4 w-4" />,
                            pub: <Beer className="h-4 w-4" />,
                            hotel: <Hotel className="h-4 w-4" />,
                            shop: <ShoppingBag className="h-4 w-4" />,
                            supermarket: <ShoppingCart className="h-4 w-4" />,
                            bank: <Landmark className="h-4 w-4" />,
                            atm: <Banknote className="h-4 w-4" />,
                            post_office: <Mail className="h-4 w-4" />,
                            library: <BookMarked className="h-4 w-4" />,
                            museum: <Landmark className="h-4 w-4" />,
                            theatre: <Theater className="h-4 w-4" />,
                            cinema: <Film className="h-4 w-4" />,
                            station: <Train className="h-4 w-4" />,
                            bus_stop: <Bus className="h-4 w-4" />,
                            parking: <ParkingCircle className="h-4 w-4" />,
                            fuel: <Fuel className="h-4 w-4" />,
                            church: <Church className="h-4 w-4" />,
                            mosque: <Church className="h-4 w-4" />,
                            synagogue: <Church className="h-4 w-4" />,
                            cemetery: <Church className="h-4 w-4" />,
                            stadium: <Star className="h-4 w-4" />,
                            sports_centre: <Star className="h-4 w-4" />,
                            swimming_pool: <Droplet className="h-4 w-4" />,
                          };
                          return (
                            iconMap[type.toLowerCase()] || (
                              <MapPin className="h-4 w-4" />
                            )
                          );
                        };

                        return (
                          <button
                            key={index}
                            onClick={() => handleSelectSearchResult(result)}
                            className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors flex items-start gap-3"
                          >
                            <span className="shrink-0 mt-0.5 text-muted-foreground">
                              {getTypeIcon(result.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {cleanAddress}
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Gradient overlay at top */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background to-transparent pointer-events-none z-10" />

            {/* Overlaid search input */}
            <div className="absolute top-2 left-4 right-4 z-20 pointer-events-auto">
              <InputGroup className="shadow-lg bg-background/95 backdrop-blur-sm">
                <InputGroupInput
                  type="text"
                  placeholder="Search address..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
                <InputGroupAddon>
                  <Search className="h-4 w-4" />
                </InputGroupAddon>
              </InputGroup>
            </div>

            {/* Gradient overlay at bottom - only shows near the button */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-linear-to-t from-background via-background/70 via-40% to-transparent pointer-events-none z-10" />

            {/* Overlaid send button */}
            <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
              <Button
                onClick={async () => {
                  if (!selectedLocation || !conversationId) return;

                  const payload = {
                    body:
                      addressInput ||
                      `Location: ${selectedLocation.lat.toFixed(
                        6
                      )}, ${selectedLocation.lng.toFixed(6)}`,
                    message_type: "location",
                    metadata: {
                      location: {
                        lat: selectedLocation.lat,
                        lng: selectedLocation.lng,
                        address: addressInput || undefined,
                      },
                    },
                  };

                  try {
                    const res = await fetch(`/api/messages/${conversationId}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });

                    if (!res.ok) {
                      throw new Error("Failed to send location");
                    }

                    setLocationDrawerOpen(false);
                    setSelectedLocation(null);
                    setAddressInput("");
                  } catch (error) {
                    console.error("Error sending location:", error);
                    toast.error("Failed to send location");
                  }
                }}
                disabled={!selectedLocation}
                className="w-full shadow-lg"
              >
                Send location
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Full-page location viewer modal */}
      <Dialog
        open={viewLocationModalOpen}
        onOpenChange={setViewLocationModalOpen}
      >
        <DialogContent className="max-w-[100vw] w-full h-full max-h-screen p-0 gap-0">
          <DialogTitle className="sr-only">Location Viewer</DialogTitle>
          <div className="relative w-full h-full flex flex-col">
            {/* Map container */}
            <div className="flex-1 relative">
              {viewingLocation && (
                <LocationViewerMap
                  location={viewingLocation}
                  onGetDirections={() => {
                    setDirectionsDrawerOpen(true);
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Directions drawer */}
      <MapDirections
        open={directionsDrawerOpen}
        onOpenChange={setDirectionsDrawerOpen}
        station={
          viewingLocation
            ? {
                name: viewingLocation.address || "Selected Location",
                coordinates: [viewingLocation.lng, viewingLocation.lat],
              }
            : null
        }
      />

      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          // TODO: Handle photo selection
          setSendDrawerOpen(false);
        }}
      />

      {/* AI Tools Install Dialog */}
      <AIToolsDialog
        open={aiToolsDialogOpen}
        onOpenChange={(open) => {
          setAiToolsDialogOpen(open);
          if (!open && pendingTranslateMessage && modelState === "ready") {
            // Dialog closed and model is ready - now translate in the message bubble
            const msg = pendingTranslateMessage;
            setPendingTranslateMessage(null);
            performTranslation(msg);
          } else if (!open) {
            setPendingTranslateMessage(null);
          }
        }}
        modelState={modelState}
        loadingProgress={loadingProgress}
        onInstall={async () => {
          // Just initialize the model, don't translate yet
          await initializeModel();
          // Translation will happen when dialog closes via onOpenChange
        }}
      />

      {/* Message Info drawer */}
      <Drawer open={infoDrawerOpen} onOpenChange={setInfoDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Message Info</DrawerTitle>
            <DrawerDescription>Delivery and read status</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-5">
            {infoMessage ? (
              <>
                {/* Quoted message */}
                <div className="rounded-lg bg-muted/50 p-3 border-l-2 border-primary">
                  <p className="text-sm leading-relaxed text-foreground wrap-break-word">
                    {infoMessage.body}
                  </p>
                </div>

                {/* Delivery status - show only latest status */}
                <div className="space-y-3">
                  {(() => {
                    // Determine latest status
                    if (
                      infoMessage.read_at &&
                      infoMessage.created_at &&
                      (infoMessage.delivered_at
                        ? new Date(infoMessage.read_at).getTime() >=
                          new Date(infoMessage.delivered_at).getTime()
                        : new Date(infoMessage.read_at).getTime() >=
                          new Date(infoMessage.created_at).getTime())
                    ) {
                      // Show Read
                      return (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Read
                          </div>
                          <div className="text-sm font-medium">
                            {formatRelativeDate(infoMessage.read_at)}
                          </div>
                        </>
                      );
                    } else if (
                      infoMessage.delivered_at &&
                      infoMessage.created_at &&
                      new Date(infoMessage.delivered_at).getTime() >=
                        new Date(infoMessage.created_at).getTime()
                    ) {
                      // Show Delivered
                      return (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Delivered
                          </div>
                          <div className="text-sm font-medium">
                            {formatRelativeDate(infoMessage.delivered_at)}
                          </div>
                        </>
                      );
                    } else {
                      // Show Sent
                      return (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Sent
                          </div>
                          <div className="text-sm font-medium">
                            {infoMessage.created_at
                              ? formatRelativeDate(infoMessage.created_at)
                              : "—"}
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>
              </>
            ) : null}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setInfoDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Link Viewer drawer */}
      <Drawer open={linkViewerDrawerOpen} onOpenChange={setLinkViewerDrawerOpen}>
        <DrawerContent className="h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="truncate text-sm">
              {viewingLinkUrl ? new URL(viewingLinkUrl).hostname.replace(/^www\./, '') : 'Link'}
            </DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4">
            {viewingLinkUrl && (
              <iframe
                src={viewingLinkUrl}
                className="w-full h-full min-h-[70vh] border-0 rounded"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                title="Link preview"
              />
            )}
          </ScrollArea>
          <div className="flex justify-between items-center px-4 pb-4 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewingLinkUrl) {
                  window.open(viewingLinkUrl, "_blank");
                }
              }}
            >
              Open in browser
            </Button>
            <Button variant="ghost" onClick={() => setLinkViewerDrawerOpen(false)}>
              Close
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
