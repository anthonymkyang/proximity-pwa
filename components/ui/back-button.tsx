"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function BackButton() {
  const router = useRouter();

  return (
    <motion.div>
      <motion.button
        onClick={() => router.back()}
        aria-label="Go back"
        whileTap={{ scale: 1.15 }}
        drag
        dragElastic={0.2}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-[inset_0_0_1px_rgba(255,255,255,0.4),0_0_8px_rgba(255,255,255,0.08),0_2px_10px_rgba(0,0,0,0.3)] hover:bg-white/10 transition-all duration-300 active:scale-110"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </motion.button>
    </motion.div>
  );
}
