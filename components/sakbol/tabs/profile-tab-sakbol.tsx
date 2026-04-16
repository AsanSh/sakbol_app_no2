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
import { ProfileAvatar } from "@/components/ui/avatar";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import {
  updateOwnProfileBasics,
  updateProfileBiologicalSex,
} from "@/app/actions/profile";
import { ageYearsFromIsoDob } from "@/lib/risk-scores";

const PROFILE_EXTRAS_STORAGE_KEY = "sakbol.profile.extras.v1";

type ProfileExtras = {
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
};

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
  const [bloodTypeInput, setBloodTypeInput] = useState("");
  const [savingBasics, setSavingBasics] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [extrasByProfile, setExtrasByProfile] = useState<Record<string, ProfileExtras>>({});

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
  const selfExtras = viewer ? extrasByProfile[viewer.id] : undefined;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROFILE_EXTRAS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ProfileExtras>;
      setExtrasByProfile(parsed);
    } catch {
      /* ignore parse/storage errors */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_EXTRAS_STORAGE_KEY, JSON.stringify(extrasByProfile));
    } catch {
      /* ignore storage errors */
    }
  }, [extrasByProfile]);

  useEffect(() => {
    if (!dataOpen) return;
    setNameInput(selfProfile?.displayName ?? viewer?.displayName ?? "");
    setAgeInput(age != null ? String(age) : "");
    setHeightInput(
      typeof selfExtras?.heightCm === "number" ? String(selfExtras.heightCm) : "",
    );
    setWeightInput(
      typeof selfExtras?.weightKg === "number" ? String(selfExtras.weightKg) : "",
    );
    setBloodTypeInput(selfExtras?.bloodType ?? "");
    setSaveError(null);
  }, [dataOpen, selfProfile?.displayName, viewer?.displayName, age, selfExtras?.heightCm, selfExtras?.weightKg, selfExtras?.bloodType]);

  const bmiPreview = (() => {
    const h = Number.parseFloat(heightInput);
    const w = Number.parseFloat(weightInput);
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
    const m = h / 100;
    return (w / (m * m)).toFixed(1);
  })();

  const bmiFromSavedExtras = (() => {
    const h = selfExtras?.heightCm;
    const w = selfExtras?.weightKg;
    if (typeof h !== "number" || typeof w !== "number" || h <= 0 || w <= 0) return null;
    const m = h / 100;
    return (w / (m * m)).toFixed(1);
  })();

  const onSaveBasics = async () => {
    setSaveError(null);
    setSavingBasics(true);
    try {
      // Локальные данные (рост/вес/группа крови) сохраняем ВСЕГДА — независимо от сервера.
      if (viewer) {
        const h = Number.parseFloat(heightInput);
        const w = Number.parseFloat(weightInput);
        setExtrasByProfile((prev) => ({
          ...prev,
          [viewer.id]: {
            heightCm: Number.isFinite(h) && h > 0 ? h : undefined,
            weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
            bloodType: bloodTypeInput.trim() || undefined,
          },
        }));
      }

      // Серверное сохранение имени и возраста — независимо от локального.
      const ageYearsRaw = ageInput.trim();
      const ageYears =
        ageYearsRaw === "" ? null : Number.parseInt(ageYearsRaw, 10);
      const res = await updateOwnProfileBasics({
        displayName: nameInput,
        ageYears,
      });
      if (!res.ok) {
        setSaveError(res.error);
        // Не выходим: локальные данные уже сохранены, закрываем sheet всё равно.
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
                {/* avatarUrl: сначала из viewer (Telegram), затем из selfProfile (БД) */}
                {(() => {
                  const url = viewer.avatarUrl ?? selfProfile?.avatarUrl ?? null;
                  return (
                    <ProfileAvatar
                      src={url}
                      name={viewer.displayName}
                      size={56}
                      className="border-2 border-white/70"
                    />
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#d4e6e9]">ID {clinical}</p>
                  <p className="font-manrope text-lg font-extrabold">{viewer.displayName}</p>
                  <p className="text-xs text-[#b7eaff]">
                    {age != null ? `${age} лет` : "Возраст не указан"} · Бишкек
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                      BMI {bmiFromSavedExtras ?? "—"}
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
                {
                  icon: "height",
                  label: "Рост",
                  val: selfExtras?.heightCm ? `${selfExtras.heightCm} см` : "—",
                },
                {
                  icon: "monitor_weight",
                  label: "Вес",
                  val: selfExtras?.weightKg ? `${selfExtras.weightKg} кг` : "—",
                },
                { icon: "monitor_heart", label: "BMI", val: bmiFromSavedExtras ?? "—" },
                { icon: "bloodtype", label: "Группа", val: selfExtras?.bloodType ?? "—" },
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
                { label: "Личные данные", onClick: () => setDataOpen(true) },
                { label: "Уведомления", onClick: () => setNotifyOpen(true) },
                { label: "Конфиденциальность", onClick: () => setPrivacyOpen(true) },
                { label: "Язык", onClick: () => {} },
                { label: "Поддержка", onClick: () => setSupportOpen(true) },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#191c1d] hover:bg-[#f8f9fa]"
                  >
                    {item.label}
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
          className="mt-4 w-full rounded-xl bg-sakbol-cta py-3 font-semibold text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.04]"
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
          <input
            placeholder="Группа крови (например: O(I)+)"
            value={bloodTypeInput}
            onChange={(e) => setBloodTypeInput(e.target.value.slice(0, 12))}
            className="w-full rounded-lg border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
          />
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

      <BottomSheet open={notifyOpen} title="Уведомления" onClose={() => setNotifyOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Этот раздел в разработке. В следующем релизе тут будут push- и Telegram-настройки.
        </p>
      </BottomSheet>

      <BottomSheet open={privacyOpen} title="Конфиденциальность" onClose={() => setPrivacyOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Уже сейчас в PDF-выгрузках и предпросмотре анализов не используются ФИО, только псевдо-ID.
        </p>
      </BottomSheet>

      <BottomSheet open={supportOpen} title="Поддержка" onClose={() => setSupportOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Если что-то не работает, напишите в поддержку и приложите скриншот + время события.
        </p>
      </BottomSheet>
    </div>
  );
}
