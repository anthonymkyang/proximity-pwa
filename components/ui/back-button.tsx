"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Button32, {
  type Button32Variant,
} from "@/components/shadcn-studio/button/button-32";

interface BackButtonProps {
  useWizardNavigation?: boolean;
  onWizardBack?: () => void;
  onClick?: () => void;
  className?: string;
  variant?: Button32Variant;
}

export default function BackButton({
  useWizardNavigation = false,
  onWizardBack,
  onClick,
  className,
  variant,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (useWizardNavigation && onWizardBack) {
      onWizardBack();
    } else {
      router.back();
    }
  };

  return (
    <Button32
      aria-label="Go back"
      onClick={handleClick}
      className={className}
      variant={variant}
    >
      <ChevronLeft className="h-6 w-6" />
    </Button32>
  );
}
