import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Avatar04Props = {
  src?: string | null;
  alt?: string | null;
  name?: string | null;
  fallback?: string | null;
  /**
   * Size utility. Provide a Tailwind size utility like `size-12` or explicit `h-10 w-10`.
   * Defaults to `size-12` to match the registry demo.
   */
  sizeClassName?: string;
  className?: string;
};

function initialsFrom(text?: string | null) {
  if (!text) return "U";
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last || first || "U").toUpperCase().slice(0, 2);
}

/**
 * Avatar04 — shadcn studio "avatar-04" turned into a reusable component.
 * Keeps the same visual as the demo (rounded, sized), but accepts real data.
 */
export default function Avatar04({
  src,
  alt,
  name,
  fallback,
  sizeClassName = "size-12",
  className,
}: Avatar04Props) {
  const fb = (fallback && fallback.trim()) || initialsFrom(name || alt);
  return (
    <Avatar className={cn(sizeClassName, className)}>
      {src ? <AvatarImage src={src} alt={alt || name || "Avatar"} /> : null}
      <AvatarFallback className="text-xs">{fb}</AvatarFallback>
    </Avatar>
  );
}

// Optional example usage (kept for parity with registry demos)
export const Avatar04Demo = () => (
  <Avatar04
    src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png"
    alt="Hallie Richards"
    fallback="HR"
  />
);
