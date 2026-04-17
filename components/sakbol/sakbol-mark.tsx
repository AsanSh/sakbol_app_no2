"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** Круглый маркер приложения (как в превью чата Telegram). */
const SRC = "/brand/sakbol-doctor-avatar.png";

type Props = {
  /** sm — компактная шапка; md — обычный top-bar; lg — экран входа */
  size: "sm" | "md" | "lg";
  className?: string;
};

const dimPx = { sm: 32, md: 40, lg: 56 } as const;

export function SakbolMark({ size, className }: Props) {
  const px = dimPx[size];
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-teal-100 shadow-sm ring-2 ring-white",
        size === "sm" && "h-8 w-8",
        size === "md" && "h-10 w-10",
        size === "lg" && "h-14 w-14",
        className,
      )}
    >
      <Image
        src={SRC}
        alt="Sakbol"
        title="Sakbol"
        fill
        className="object-cover object-[center_15%]"
        sizes={`${px}px`}
        priority
      />
    </div>
  );
}
