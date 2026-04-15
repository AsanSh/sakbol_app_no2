"use client";

import { useEffect, useState } from "react";
import { BiologicalSex } from "@prisma/client";
import { AddMemberModal } from "@/components/add-member-modal";
import { CopyIdButton } from "@/components/copy-id-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useLanguage } from "@/context/language-context";
import { useTabApp } from "@/context/tab-app-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import type { FamilyWithProfiles } from "@/types/family";
import { t } from "@/lib/i18n";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import {
  updateOwnProfileBasics,
  updateProfileBiologicalSex,
} from "@/app/actions/profile";
import { ageYearsFromIsoDob } from "@/lib/risk-scores";

type Props = {
  family: FamilyWithProfiles | null;
  loading: boolean;
  reload: () => void;
};

export function ProfileTabSakbol({ family, loading, reload }: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const { openDiary } = useTabApp();
  const [addOpen, setAddOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [savingBasics, setSavingBasics] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const viewer = state.status === "authenticated" ? state.viewer : null;
  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");
  const selfProfile = viewer ? family?.profiles.find((p) => p.id === viewer.id) : null;
  const age = selfProfile?.dateOfBirth ? ageYearsFromIsoDob(selfProfile.dateOfBirth) : null;

  const canEditSex = (profileId: string) => {
    if (!viewer) return false;
    if (viewer.id === profileId) return true;
    return viewer.familyRole === "ADMIN";
  };

  const clinical = viewer ? formatClinicalAnonymId(viewer.id) : "—";

  useEffect(() => {
    if (!dataOpen) return;
    setNameInput(selfProfile?.displayName ?? viewer?.displayName ?? "");
    setAgeInput(age != null ? String(age) : "");
    setHeightInput("");
    setWeightInput("");
    setSaveError(null);
  }, [dataOpen, selfProfile?.displayName, viewer?.displayName, age]);

  const bmiPreview = (() => {
    const h = Number.parseFloat(heightInput);
    const w = Number.parseFloat(weightInput);
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
    const m = h / 100;
    return (w / (m * m)).toFixed(1);
  })();

  const onSaveBasics = async () => {
    setSaveError(null);
    setSavingBasics(true);
    try {
      const ageYearsRaw = ageInput.trim();
      const ageYears =
        ageYearsRaw === "" ? null : Number.parseInt(ageYearsRaw, 10);
      const res = await updateOwnProfileBasics({
        displayName: nameInput,
        ageYears,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      reload();
      setDataOpen(false);
    } finally {
      setSavingBasics(false);
    }
  };

  return (
    <div className="w-full">
      <SakbolTopBar
        rightSlot={
          <button
            type="button"
            onClick={() => setDataOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f4f5] text-[#40484c]"
            aria-label="Редактировать"
          >
            <MaterialIcon name="edit" className="text-[20px]" />
          </button>
        }
      />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-4 pt-2">
        {!authReady ? (
          <p className="text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && !isAuthenticated ? (
          <div className="rounded-2xl border border-[#ffdcc0] bg-[#ffdcc0]/50 px-4 py-3 text-sm text-[#2d1600]">
            <p className="font-medium">{t(lang, "dashboard.authTitle")}</p>
            <p className="mt-1 text-xs text-[#693c08]">
              {state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                  ? t(lang, "dashboard.authTelegramRetry")
                  : t(lang, "dashboard.authBody")}
            </p>
            {state.status === "unauthenticated" &&
            state.reason &&
            state.reason !== "no_init_data" &&
            state.reason !== "telegram_init_data_missing" ? (
              <p className="mt-2 rounded-lg bg-white/60 px-2 py-1.5 font-mono text-[10px] leading-snug text-[#5c3200]">
                {state.reason}
              </p>
            ) : null}
          </div>
        ) : null}

        {authReady && isAuthenticated && viewer ? (
          <>
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#004253] to-[#005b71] p-4 text-white shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40">
                  <span className="font-manrope text-lg font-extrabold">
                    {viewer.displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#d4e6e9]">ID {clinical}</p>
                  <p className="font-manrope text-lg font-extrabold">{viewer.displayName}</p>
                  <p className="text-xs text-[#b7eaff]">
                    {age != null ? `${age} лет` : "Возраст не указан"} · Бишкек
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                      BMI 24,2
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                      Score 78
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#ffdcc0] to-[#ffead4] p-4 text-left shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-amber-700">
                  <MaterialIcon name="workspace_premium" className="text-[28px]" filled />
                </div>
                <div className="flex-1">
                  <p className="font-manrope font-bold text-[#2d1600]">Sakbol Premium</p>
                  <p className="text-xs text-[#693c08]">Безлимит анализов и семья</p>
                </div>
                <span className="rounded-full bg-[#5c3200] px-3 py-1.5 text-[11px] font-bold text-[#ffead4]">
                  Попробовать
                </span>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: "height", label: "Рост", val: "—" },
                { icon: "monitor_weight", label: "Вес", val: "—" },
                { icon: "monitor_heart", label: "BMI", val: "24,2" },
                { icon: "bloodtype", label: "Группа", val: "—" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-[#e7e8e9] bg-white p-3 text-center shadow-sm"
                >
                  <MaterialIcon name={c.icon} className="mx-auto text-[#004253]" />
                  <p className="mt-1 text-[10px] text-[#70787d]">{c.label}</p>
                  <p className="font-manrope text-sm font-bold text-[#191c1d]">{c.val}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={openDiary}
              className="flex w-full items-center justify-between rounded-2xl border border-[#e7e8e9] bg-white px-4 py-3 text-left shadow-sm"
            >
              <span className="flex items-center gap-2 font-medium text-[#191c1d]">
                <MaterialIcon name="menu_book" className="text-[#004253]" />
                Дневник здоровья
              </span>
              <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
            </button>

            <section className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-manrope text-sm font-bold text-[#191c1d]">
                  {t(lang, "profile.family")}
                </h2>
                {admin ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="rounded-full bg-[#004253] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t(lang, "profile.addMember")}
                  </button>
                ) : null}
              </div>
              {loading ? (
                <p className="mt-3 text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
              ) : family?.profiles?.length ? (
                <ul className="mt-3 space-y-2">
                  {family.profiles.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-[#f3f4f5] bg-[#f8f9fa] px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#191c1d]">{p.displayName}</span>
                        <span className="text-xs text-[#70787d]">{p.familyRole}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#70787d]">
                        <span>
                          {t(lang, "profile.clinicalIdShort")}: {formatClinicalAnonymId(p.id)}
                        </span>
                        <CopyIdButton
                          text={formatClinicalAnonymId(p.id)}
                          label={t(lang, "profile.copyId")}
                        />
                      </div>
                      {canEditSex(p.id) ? (
                        <label className="mt-2 flex flex-col gap-0.5 text-[11px] text-[#40484c]">
                          <span>{t(lang, "profile.biologicalSex")}</span>
                          <select
                            className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
                            value={p.biologicalSex}
                            onChange={(e) => {
                              const v = e.target.value as BiologicalSex;
                              void updateProfileBiologicalSex(p.id, v).then(() => reload());
                            }}
                          >
                            <option value={BiologicalSex.UNKNOWN}>{t(lang, "profile.sexUnknown")}</option>
                            <option value={BiologicalSex.MALE}>{t(lang, "profile.sexMale")}</option>
                            <option value={BiologicalSex.FEMALE}>{t(lang, "profile.sexFemale")}</option>
                          </select>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#70787d]">{t(lang, "profile.noProfiles")}</p>
              )}
            </section>

            <section className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-[#191c1d]">{t(lang, "profile.language")}</h2>
              <p className="mt-1 text-xs text-[#70787d]">{t(lang, "profile.languageHint")}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-[#40484c]">RU / KG</span>
                <LanguageSwitcher />
              </div>
            </section>

            <ul className="space-y-1 rounded-2xl border border-[#e7e8e9] bg-white p-2 shadow-sm">
              {[
                "Личные данные",
                "Уведомления",
                "Конфиденциальность",
                "Язык",
                "Поддержка",
              ].map((label) => (
                <li key={label}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#191c1d] hover:bg-[#f8f9fa]"
                  >
                    {label}
                    <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-center text-[10px] text-[#70787d]">
              Версия 0.1 · Кыргызстан 🇰🇬
            </p>
          </>
        ) : null}
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />

      <BottomSheet open={premiumOpen} title="Premium" onClose={() => setPremiumOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Месяц 299 сом / год 2 990 сом — безлимит загрузок и семейные профили (мок).
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#004253] to-[#005b71] py-3 font-semibold text-white"
        >
          Активировать
        </button>
      </BottomSheet>

      <BottomSheet open={dataOpen} title="Личные данные" onClose={() => setDataOpen(false)}>
        <p className="text-xs text-[#70787d]">
          Имя и возраст сохраняются в профиль. Рост/вес используются для локального расчёта BMI.
        </p>
        <div className="mt-3 space-y-2 rounded-xl bg-[#f3f4f5] p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <input
            placeholder="Имя"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full rounded-lg border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
          />
          <input
            placeholder="Возраст"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="w-full rounded-lg border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Рост, см"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="rounded-lg border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Вес, кг"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="rounded-lg border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-[#40484c]">
            BMI: {bmiPreview ?? "—"} {bmiPreview ? "(локальный расчёт)" : ""}
          </p>
          {saveError ? <p className="text-xs text-coral">{saveError}</p> : null}
        </div>
        <div className="sticky bottom-0 mt-3 border-t border-[#e7e8e9] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur">
          <button
            type="button"
            onClick={() => void onSaveBasics()}
            disabled={savingBasics}
            className="w-full rounded-lg bg-[#004253] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingBasics ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
