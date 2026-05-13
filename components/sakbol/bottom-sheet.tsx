"use client";

import type { ReactNode } from "react";
import { MaterialIcon } from "@/components/sakbol/material-icon";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ open, title, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-ui-surface shadow-2xl ring-1 ring-ui-border/50">
        <div className="sticky top-0 flex items-center justify-between border-b border-ui-border bg-ui-surface px-4 py-3">
          <h2 className="font-manrope text-base font-bold text-ui-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ui-border-subtle text-ui-muted transition-colors hover:bg-ui-border"
            aria-label="Закрыть"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
