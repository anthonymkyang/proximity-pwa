"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import getAvatarProxyUrl from "@/lib/profiles/getAvatarProxyUrl";

type ConnectionResponse = {
  connection: {
    id: string;
    type: "contact" | "pin";
    title: string;
    note?: string | null;
    connection_contacts?: any;
    connection_pins?: any;
  };
};

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = Array.isArray((params as any)?.id)
    ? (params as any)?.id[0]
    : (params as any)?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConnectionResponse["connection"] | null>(
    null
  );

  useEffect(() => {
    if (!connectionId) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/connections/${connectionId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Failed to load contact");
        return body as ConnectionResponse;
      })
      .then((body) => {
        if (!active) return;
        setData(body.connection);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load contact");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [connectionId]);

  const contact = useMemo(() => {
    if (!data || data.type !== "contact") return null;
    return Array.isArray(data.connection_contacts)
      ? data.connection_contacts[0]
      : data.connection_contacts;
  }, [data]);

  const pinned = useMemo(() => {
    if (!data || data.type !== "pin") return null;
    return Array.isArray(data.connection_pins)
      ? data.connection_pins[0]
      : data.connection_pins;
  }, [data]);

  const avatarUrl = useMemo(() => {
    const raw =
      pinned?.pinned_profile?.avatar_url ??
      contact?.profiles?.avatar_url ??
      null;
    return raw ? getAvatarProxyUrl(raw) : null;
  }, [pinned, contact]);

  const title =
    data?.title ||
    contact?.display_name ||
    pinned?.nickname ||
    pinned?.pinned_profile?.profile_title ||
    "Connection";

  const metadata = contact?.metadata || {};

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Contact</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Badge
                className={cn(
                  "absolute -left-1 -top-1 z-20 h-5 w-5 rounded-full p-0 grid place-items-center",
                  data.type === "contact"
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white"
                )}
              >
                {data.type === "contact" ? (
                  <User className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="sr-only">
                  {data.type === "contact" ? "Contact" : "Pinned"}
                </span>
              </Badge>
              <Avatar className="h-14 w-14">
                <AvatarImage
                  src={avatarUrl || (undefined as unknown as string)}
                  alt={title}
                />
                <AvatarFallback>{title.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{title}</div>
              {contact?.handle ? (
                <div className="text-sm text-muted-foreground truncate">
                  @{contact.handle}
                </div>
              ) : pinned?.pinned_profile?.username ? (
                <div className="text-sm text-muted-foreground truncate">
                  @{pinned.pinned_profile.username}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Details
            </div>
            {contact ? (
              <div className="space-y-2 text-sm">
                {contact.display_name ? (
                  <div>
                    <div className="text-muted-foreground">Nickname</div>
                    <div className="font-medium">{contact.display_name}</div>
                  </div>
                ) : null}
                {metadata?.whatsapp ? (
                  <div>
                    <div className="text-muted-foreground">WhatsApp</div>
                    <div className="font-medium">{metadata.whatsapp}</div>
                  </div>
                ) : null}
                {metadata?.telegram ? (
                  <div>
                    <div className="text-muted-foreground">Telegram</div>
                    <div className="font-medium">{metadata.telegram}</div>
                  </div>
                ) : null}
                {!metadata?.whatsapp && !metadata?.telegram && !contact.display_name ? (
                  <div className="text-muted-foreground">No extra details.</div>
                ) : null}
              </div>
            ) : pinned ? (
              <div className="text-sm text-muted-foreground">
                Pinned profile connection.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No details available.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
