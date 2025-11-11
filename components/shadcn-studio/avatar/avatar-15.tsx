import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Avatar15Props = {
  avatars: {
    src?: string | null;
    fallback?: string | null;
    name?: string | null;
  }[];
  sizeClassName?: string;
  className?: string;
};

/**
 * Avatar15 — a reusable component for co-host avatars.
 * Displays multiple avatars in a compact overlapping group.
 */
export default function Avatar15({
  avatars,
  sizeClassName = "size-12",
  className,
}: Avatar15Props) {
  if (!avatars?.length) return null;

  const fallbackInitials = (text?: string | null) => {
    if (!text) return "U";
    const parts = String(text).trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return (first + last || first || "U").toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn("flex -space-x-2", className)}>
      {avatars.map((avatar, index) => {
        const fb = avatar.fallback || fallbackInitials(avatar.name);
        return (
          <Avatar
            key={index}
            className={cn("ring-background ring-2", sizeClassName)}
          >
            {avatar.src ? (
              <AvatarImage src={avatar.src} alt={avatar.name || "Co-host"} />
            ) : null}
            <AvatarFallback className="text-xs">{fb}</AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

export const Avatar15Demo = () => (
  <Avatar15
    avatars={[
      {
        src: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png",
        name: "Marcus Chen",
        fallback: "MC",
      },
      {
        src: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-4.png",
        name: "Elena Perez",
        fallback: "EP",
      },
      {
        src: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png",
        name: "David Kim",
        fallback: "DK",
      },
    ]}
  />
);
