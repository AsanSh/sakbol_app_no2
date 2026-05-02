"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { hapticImpact } from "@/lib/telegram-haptics";

type Props = {
  onClick: () => void;
  /** Показывать только на мобилке (по умолчанию true) */
  mobileOnly?: boolean;
};

/**
 * Floating Action Button — плавает в правом нижнем углу.
 * Используется вместо кнопки «Загрузить» во всю ширину.
 */
export function UploadFab({ onClick, mobileOnly = true }: Props) {
  return (
    <motion.button
      type="button"
      aria-label="Загрузить анализ"
      onClick={() => {
        hapticImpact("medium");
        onClick();
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
      whileTap={{ scale: 0.9 }}
      className={
        mobileOnly
          ? "md:hidden fixed bottom-[calc(5.5rem+1.5rem+env(safe-area-inset-bottom,0px))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sakbol-cta text-white shadow-cta-coral ring-2 ring-white/40 transition-[filter] hover:brightness-[1.06] active:brightness-[0.97]"
          : "fixed bottom-[calc(5.5rem+1.5rem+env(safe-area-inset-bottom,0px))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sakbol-cta text-white shadow-cta-coral ring-2 ring-white/40 transition-[filter] hover:brightness-[1.06] active:brightness-[0.97] md:bottom-6 md:right-6"
      }
    >
      {/* Пульсирующее кольцо */}
      <span className="absolute inset-0 animate-ping rounded-full bg-[#004253]/25" aria-hidden />
      <Plus size={24} strokeWidth={2.5} aria-hidden />
    </motion.button>
  );
}
