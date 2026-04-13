"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Pill, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

export function BottomNav() {
  const pathname = usePathname();
  const { lang } = useLanguage();

  const items = [
    { href: "/" as const, label: t(lang, "nav.home"), icon: Home },
    { href: "/tests" as const, label: t(lang, "nav.tests"), icon: ClipboardList },
    { href: "/meds" as const, label: t(lang, "nav.meds"), icon: Pill },
    { href: "/profile" as const, label: t(lang, "nav.profile"), icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-800/30 bg-emerald-900 text-mint shadow-[0_-4px_24px_rgba(0,105,92,0.35)] [padding-bottom:max(0.5rem,env(safe-area-inset-bottom,0px))]"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg list-none items-stretch justify-around gap-1 px-2 pt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-emerald-800/80 text-amber-500"
                    : "text-mint/85 hover:bg-emerald-800/50 hover:text-mint",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
