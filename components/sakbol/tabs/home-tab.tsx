"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FamilyRole } from "@prisma/client";
import { AddMemberModal } from "@/components/add-member-modal";
import { FamilySwitcher } from "@/components/family-switcher";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useDeviceType } from "@/hooks/use-device-type";
import type { FamilyWithProfiles } from "@/types/family";
import { ProfileNotificationsContent } from "@/components/profile/profile-settings-sheets";
import { DoctorDiscoveryHome } from "@/features/home/doctor-discovery-home";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  family: FamilyWithProfiles | null;
  reloadFamily: () => void;
};

export function HomeTab({ family, reloadFamily }: Props) {
  const searchParams = useSearchParams();
  const doctorCat = searchParams.get("doctorCat");
  const { lang } = useLanguage();
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";
  const { state, authReady, isAuthenticated } = useTelegramSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const admin = useMemo(
    () => family?.profiles.find((p) => p.familyRole === FamilyRole.ADMIN),
    [family?.profiles],
  );

  const headerSwitcher =
    authReady && isAuthenticated && family?.profiles?.length ? (
      <FamilySwitcher
        variant="header"
        profiles={family.profiles}
        canAddMember={!!admin}
        onAddMember={admin ? () => setAddMemberOpen(true) : undefined}
        joinFamilyHref="/join-family"
      />
    ) : null;

  const sharedSheets = (
    <BottomSheet open={notificationsOpen} title="Уведомления" onClose={() => setNotificationsOpen(false)}>
      <ProfileNotificationsContent />
    </BottomSheet>
  );

  const authBanner = (
    <>
      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
          <p className="font-semibold">{t(lang, "dashboard.authTitle")}</p>
          <p className="mt-1 text-caption text-amber-900/90">
            {state.status === "unauthenticated" && state.reason === "web_login_required"
              ? "Сессия не найдена. Откройте вход: код из Telegram или email и пароль."
              : state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                  ? t(lang, "dashboard.tgLoginHint")
                  : t(lang, "dashboard.authBody")}
          </p>
          {state.status === "unauthenticated" &&
          (state.reason === "web_login_required" || state.reason === "telegram_init_data_missing") ? (
            <Link
              href="/login"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-health-text px-4 py-2 text-caption font-semibold text-health-surface"
            >
              Войти на сайте
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (isDesktopWeb) {
    return (
      <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-y-auto")}>
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-8 pt-2 md:px-6">
          {authBanner}
          <DoctorDiscoveryHome isDesktop initialCategorySlug={doctorCat} />
        </div>
        <AddMemberModal
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onCreated={() => {
            reloadFamily();
            setAddMemberOpen(false);
          }}
          familyProfilesForInvite={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <SakbolTopBar
        showBell
        bellUnread
        onBell={() => setNotificationsOpen(true)}
        centerSlot={headerSwitcher}
      />
      <motion.div
        className="mx-auto max-w-2xl space-y-6 px-4 pb-6 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {authBanner}
        <DoctorDiscoveryHome initialCategorySlug={doctorCat} />
        {sharedSheets}
        <AddMemberModal
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onCreated={() => {
            reloadFamily();
            setAddMemberOpen(false);
          }}
          familyProfilesForInvite={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
        />
      </motion.div>
    </div>
  );
}
