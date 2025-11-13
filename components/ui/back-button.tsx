"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Button32 from "@/components/shadcn-studio/button/button-32";

interface BackButtonProps {
  useWizardNavigation?: boolean;
  onWizardBack?: () => void;
  onClick?: () => void;
}

export default function BackButton({
  useWizardNavigation = false,
  onWizardBack,
  onClick,
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
    <Button32 aria-label="Go back" onClick={handleClick}>
      <ChevronLeft className="h-6 w-6" />
    </Button32>
  );
}
