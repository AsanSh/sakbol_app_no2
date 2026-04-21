"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X } from "lucide-react";
import type { PhoneSelectEntry } from "@/lib/callDoctor";
import { formatPhoneDisplay, getTelLinkProps } from "@/lib/callDoctor";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  entries: PhoneSelectEntry[];
  title: string;
  cancelLabel: string;
  callActionLabel: string;
  className?: string;
};

/**
 * Выбор номера при нескольких телефонах: снизу на мобильных, по центру на sm+.
 */
export function PhoneSelectModal({
  open,
  onClose,
  entries,
  title,
  cancelLabel,
  callActionLabel,
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && entries.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4",
            className,
          )}
          role="dialog"
          aria-modal
          aria-labelledby="phone-select-modal-title"
        >
          <motion.div
            initial={{ y: 28 }}
            animate={{ y: 0 }}
            exit={{ y: 20 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="phone-select-modal-title"
                className="font-manrope text-lg font-semibold leading-snug text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                onClick={onClose}
                aria-label={cancelLabel}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-caption text-slate-500">{callActionLabel}</p>

            <ul className="mt-4 flex flex-col gap-2" role="list">
              {entries.map((e) => {
                const link = getTelLinkProps(e.raw);
                if (!link) return null;
                return (
                  <li key={e.raw}>
                    <a
                      {...link}
                      onClick={() => onClose()}
                      className="flex min-h-[52px] w-full flex-col items-start justify-center gap-0.5 rounded-2xl bg-teal-50 px-4 py-3 text-left ring-1 ring-teal-100 transition hover:bg-teal-100"
                    >
                      <span className="flex w-full items-center gap-2">
                        <Phone className="h-5 w-5 shrink-0 text-teal-800" aria-hidden />
                        <span className="text-[16px] font-semibold tracking-tight text-teal-950">
                          {formatPhoneDisplay(e.raw)}
                        </span>
                      </span>
                      {e.label ? (
                        <span className="pl-7 text-[13px] text-teal-800/90">{e.label}</span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              className="mt-4 min-h-[52px] w-full rounded-2xl bg-slate-100 text-caption font-semibold text-slate-800 hover:bg-slate-200/90"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
