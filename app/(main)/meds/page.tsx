"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addMedication,
  listMedications,
  markMedicationTaken,
  sendMedicationTelegramReminder,
} from "@/app/actions/medication";
import { useActiveProfile } from "@/context/active-profile-context";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Med = { id: string; name: string; dosage: string; timeOfDay: string; takenToday: boolean };

export default function MedsPage() {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const [rows, setRows] = useState<Med[]>([]);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:00");
  const [remindId, setRemindId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeProfileId) return setRows([]);
    const r = await listMedications(activeProfileId);
    setRows(r as Med[]);
  }, [activeProfileId]);
  useEffect(() => { void reload(); }, [reload]);

  async function onConfirmTake(m: Med) {
    const ask = () => new Promise<boolean>((resolve) => {
      try {
        const tg = (window as Window & { Telegram?: { WebApp?: { showConfirm: (m: string, cb: (ok: boolean) => void) => void } } }).Telegram?.WebApp;
        if (tg?.showConfirm) tg.showConfirm(`Белгилейбизби: ${m.name}?`, (ok) => resolve(Boolean(ok)));
        else resolve(window.confirm(`Белгилейбизби: ${m.name}?`));
      } catch {
        resolve(window.confirm(`Белгилейбизби: ${m.name}?`));
      }
    });
    const ok = await ask();
    if (!ok) return;
    await markMedicationTaken(m.id, !m.takenToday);
    await reload();
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6">
      <h1 className="text-2xl font-semibold text-emerald-950">{t(lang, "meds.title")}</h1>
      <p className="mt-1 text-sm text-emerald-900/70">{t(lang, "meds.subtitle")}</p>

      <form
        className="mt-4 rounded-xl border border-emerald-900/15 bg-white p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!activeProfileId || !name.trim()) return;
          await addMedication(activeProfileId, name.trim(), dosage.trim() || "-", time);
          setName("");
          setDosage("");
          await reload();
        }}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(lang, "meds.name")} className="rounded-lg border border-emerald-900/20 px-3 py-2 text-sm" />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder={t(lang, "meds.dosage")} className="rounded-lg border border-emerald-900/20 px-3 py-2 text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-emerald-900/20 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="mt-3 rounded-lg bg-emerald-900 px-3 py-2 text-sm text-mint">{t(lang, "meds.add")}</button>
      </form>

      <ul className="mt-4 space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="rounded-xl border border-emerald-900/15 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-950">{m.name}</p>
                <p className="text-xs text-emerald-900/70">{m.dosage} · {m.timeOfDay}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button type="button" onClick={() => void onConfirmTake(m)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${m.takenToday ? "bg-mint text-emerald-950" : "bg-emerald-900 text-mint"}`}>
                  {m.takenToday ? t(lang, "meds.taken") : t(lang, "meds.mark")}
                </button>
                <button
                  type="button"
                  disabled={remindId === m.id}
                  onClick={() => {
                    setRemindId(m.id);
                    void sendMedicationTelegramReminder(m.id)
                      .then((r) => {
                        if (!r.ok && r.error === "profile_no_telegram") {
                          alert(t(lang, "meds.remindNoTg"));
                        } else if (!r.ok) {
                          alert(`${t(lang, "meds.remindFail")}: ${r.error}`);
                        }
                      })
                      .finally(() => setRemindId(null));
                  }}
                  className="text-[10px] font-medium text-emerald-800 underline underline-offset-2 disabled:opacity-50"
                >
                  {remindId === m.id ? t(lang, "meds.remindSending") : t(lang, "meds.remindTelegram")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-emerald-800/70">{t(lang, "footer.disclaimer")}</p>
    </div>
  );
}
