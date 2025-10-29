"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button onClick={() => router.back()} aria-label="Go back">
      <ChevronLeft className="h-6 w-6" />
    </button>
  );
}
