"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Pill, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

export function DesktopSidebar() {
  const pathname = usePathname();
  const { lang } = useLanguage();

  const items = [
    { href: "/" as const, label: t(lang, "nav.home"), icon: Home },
    { href: "/tests" as const, label: t(lang, "nav.tests"), icon: ClipboardList },
    { href: "/meds" as const, label: t(lang, "nav.meds"), icon: Pill },
    { href: "/profile" as const, label: t(lang, "nav.profile"), icon: User },
  ];

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-emerald-800/20 bg-emerald-900 text-mint md:flex"
      aria-label="Desktop"
    >
      <div className="border-b border-emerald-800/30 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">SakBol</p>
        <p className="mt-0.5 text-sm text-mint/90">Emerald KG</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-800/90 text-amber-500"
                  : "text-mint/85 hover:bg-emerald-800/50 hover:text-mint",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
