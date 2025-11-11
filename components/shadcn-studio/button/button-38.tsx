import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsButton() {
  return (
    <Button variant="default" size="icon" className="relative rounded-full">
      <BellIcon />
      <span className="absolute -right-0.5 -top-0.5 animate-bounce rounded-full bg-destructive dark:bg-destructive" />
      <span className="sr-only">Notifications</span>
    </Button>
  );
}
