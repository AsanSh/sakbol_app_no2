"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { text: string; label: string; className?: string };

export function CopyIdButton({ text, label, className }: Props) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-emerald-800/25 bg-white/90 px-2 py-1 text-[10px] font-medium text-emerald-900 hover:bg-emerald-900/5",
        className,
      )}
    >
      {done ? <Check className="h-3 w-3 text-emerald-700" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}
