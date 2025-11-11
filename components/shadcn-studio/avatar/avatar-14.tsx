import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface Avatar14Item {
  src?: string;
  fallback?: string;
  name?: string;
}

export interface Avatar14Props {
  avatars: Avatar14Item[];
  extraCount?: number;
  className?: string;
}

export function Avatar14({ avatars, extraCount, className }: Avatar14Props) {
  return (
    <div className={`flex -space-x-2 ${className || ""}`}>
      {avatars.map((avatar, index) => (
        <Avatar key={index} className="size-6 ring-background ring-2">
          {avatar.src ? (
            <AvatarImage src={avatar.src} alt={avatar.name || "Avatar"} />
          ) : null}
          <AvatarFallback className="text-xs">
            {avatar.fallback || ""}
          </AvatarFallback>
        </Avatar>
      ))}
      {extraCount ? (
        <Avatar className="size-6 ring-background ring-2">
          <AvatarFallback className="text-xs">+{extraCount}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

export default Avatar14;
