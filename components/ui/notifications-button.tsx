import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationsButtonProps = {
  showDot?: boolean;
};

export default function NotificationsButton({
  showDot = true,
}: NotificationsButtonProps) {
  return (
    <Button variant="default" size="icon" className="relative rounded-full">
      <BellIcon />
      {showDot ? (
        <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
      ) : null}
      <span className="sr-only">Notifications</span>
    </Button>
  );
}
