"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { useTelegramSession } from "@/context/telegram-session-context";
import { extractInviteCode9FromScannedText } from "@/lib/invite-qr-parse";
import { cn } from "@/lib/utils";

type InviteInfo = {
  id: string;
  accepted: boolean;
  canWrite: boolean;
  inviteExpiresAt: string | null;
  inviteCode9?: string;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    managedRole: string | null;
  };
};

function normalizeCode(raw: string | null): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 9);
}

type EntryTab = "code" | "qr";

function useBarcodeDetectorAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);
  return ok;
}

function JoinFamilyByCodePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = normalizeCode(searchParams.get("code"));
  const { isAuthenticated, authReady } = useTelegramSession();
  const barcodeDetectorOk = useBarcodeDetectorAvailable();

  const [entryTab, setEntryTab] = useState<EntryTab>("code");
  const [draftCode, setDraftCode] = useState("");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  const [qrPaste, setQrPaste] = useState("");
  const [qrErr, setQrErr] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current != null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const goToCode = useCallback(
    (nine: string) => {
      const v = normalizeCode(nine);
      if (v.length !== 9) return;
      stopCamera();
      setQrErr(null);
      router.replace(`/join-family?code=${v}`);
    },
    [router, stopCamera],
  );

  useEffect(() => {
    if (code.length !== 9) {
      setInfo(null);
      setLoadErr(null);
      setAccepted(false);
      return;
    }
    setLoadErr(null);
    setInfo(null);
    setAccepted(false);
    fetch(`/api/profile/share/invite-by-code/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const j = (await r.json()) as InviteInfo & { error?: string };
        if (!r.ok) {
          setLoadErr(j.error ?? "Ошибка загрузки");
          return;
        }
        setInfo(j);
        if (j.accepted) setAccepted(true);
      })
      .catch(() => setLoadErr("Ошибка сети"));
  }, [code]);

  const handleAccept = async () => {
    if (code.length !== 9) return;
    if (!authReady) return;
    if (!isAuthenticated) {
      const next = `/join-family?code=${code}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAccepting(true);
    setAcceptErr(null);
    try {
      const res = await fetch(`/api/profile/share/invite-by-code/${encodeURIComponent(code)}`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setAcceptErr(j.error ?? "Не удалось принять приглашение");
        return;
      }
      setAccepted(true);
      setTimeout(() => router.replace("/"), 2000);
    } finally {
      setAccepting(false);
    }
  };

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const v = normalizeCode(draftCode);
    if (v.length !== 9) return;
    router.replace(`/join-family?code=${v}`);
  }

  function submitPaste() {
    setQrErr(null);
    const parsed = extractInviteCode9FromScannedText(qrPaste);
    if (!parsed) {
      setQrErr("Не удалось найти 9 цифр или ссылку join_ в тексте.");
      return;
    }
    goToCode(parsed);
  }

  async function startCameraScan() {
    setQrErr(null);
    if (!barcodeDetectorOk) {
      setQrErr("Сканер камеры недоступен в этом браузере. Загрузите фото QR или вставьте ссылку.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const Detector = (
        window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
          };
        }
      ).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const parsed = extractInviteCode9FromScannedText(raw);
            if (parsed) {
              goToCode(parsed);
              return;
            }
          }
        } catch {
          /* кадр ещё не готов */
        }
        scanLoopRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };
      scanLoopRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch {
      setQrErr("Не удалось включить камеру. Разрешите доступ или загрузите скриншот QR.");
      stopCamera();
    }
  }

  async function onQrFileChange(e: ChangeEvent<HTMLInputElement>) {
    setQrErr(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const jsQR = (await import("jsqr")).default;
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setQrErr("Не удалось обработать изображение.");
        return;
      }
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      bitmap.close();
      if (!result?.data) {
        setQrErr("QR на фото не найден. Попробуйте другое изображение или введите код вручную.");
        return;
      }
      const parsed = extractInviteCode9FromScannedText(result.data);
      if (!parsed) {
        setQrErr("В QR нет нашего приглашения (нужна ссылка join_ или код из 9 цифр).");
        return;
      }
      goToCode(parsed);
    } catch {
      setQrErr("Ошибка чтения файла.");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 text-center">
        <SakbolMark size="lg" className="mx-auto" />
        <h1 className="mt-4 font-manrope text-xl font-extrabold text-[#004253]">
          В семью по приглашению
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Два способа: <strong>уникальный код</strong> (9 цифр) или <strong>QR-код</strong> (камера /
          фото / ссылка из QR).
        </p>

        {code.length !== 9 ? (
          <>
            <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                  entryTab === "code"
                    ? "bg-white text-[#004253] shadow-sm"
                    : "text-slate-600",
                )}
                onClick={() => setEntryTab("code")}
              >
                Код из 9 цифр
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                  entryTab === "qr"
                    ? "bg-white text-[#004253] shadow-sm"
                    : "text-slate-600",
                )}
                onClick={() => {
                  setEntryTab("qr");
                  setQrErr(null);
                }}
              >
                QR-код
              </button>
            </div>

            {entryTab === "code" ? (
              <form className="mt-5 space-y-3 text-left" onSubmit={submitManual}>
                <p className="text-sm text-slate-600">
                  Введите девять цифр, которые вам отправили в сообщении.
                </p>
                <label className="block text-xs font-medium text-slate-600" htmlFor="join-code">
                  Уникальный код
                </label>
                <input
                  id="join-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.35em] text-slate-900 outline-none ring-[#004253] focus-visible:ring-2"
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="000000000"
                  maxLength={9}
                />
                <button
                  type="submit"
                  disabled={normalizeCode(draftCode).length !== 9}
                  className="w-full rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845] disabled:opacity-50"
                >
                  Продолжить
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4 text-left">
                <p className="text-sm text-slate-600">
                  Наведите камеру на QR из приложения пригласившего или загрузите его фото. Также
                  можно вставить текст ссылки из QR.
                </p>

                {barcodeDetectorOk ? (
                  <div className="space-y-2">
                    {!cameraOn ? (
                      <button
                        type="button"
                        onClick={() => void startCameraScan()}
                        className="w-full rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003845]"
                      >
                        Включить камеру и сканировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                      >
                        Выключить камеру
                      </button>
                    )}
                    <video
                      ref={videoRef}
                      className={cn(
                        "aspect-square w-full rounded-2xl bg-black object-cover",
                        cameraOn ? "block" : "hidden",
                      )}
                      muted
                      playsInline
                    />
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-200">
                    В этом браузере нет встроенного сканера QR. Используйте загрузку фото или поле
                    ниже.
                  </p>
                )}

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onQrFileChange(e)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800"
                  >
                    Загрузить фото QR
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600" htmlFor="qr-paste">
                    Или вставьте ссылку из QR
                  </label>
                  <textarea
                    id="qr-paste"
                    rows={3}
                    placeholder="https://t.me/…?start=join_123456789 или ссылка на сайт с code="
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none ring-[#004253] focus-visible:ring-2"
                    value={qrPaste}
                    onChange={(e) => setQrPaste(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={submitPaste}
                    className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white"
                  >
                    Извлечь код из текста
                  </button>
                </div>

                {qrErr ? (
                  <p className="text-xs text-red-700" role="alert">
                    {qrErr}
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Код приглашения
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-slate-800">{code}</p>

            {!info && !loadErr && (
              <p className="mt-6 text-sm text-slate-500 animate-pulse">Загрузка…</p>
            )}

            {loadErr && (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
                  {loadErr === "Invite expired"
                    ? "Приглашение истекло. Попросите владельца создать новое."
                    : loadErr === "Invite not found or revoked"
                      ? "Код недействителен или доступ отозван."
                      : loadErr}
                </div>
                <button
                  type="button"
                  onClick={() => router.replace("/join-family")}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700"
                >
                  Назад: другой код или QR
                </button>
              </div>
            )}

            {info && !accepted && (
              <>
                <div className="mt-6 flex flex-col items-center gap-2">
                  {info.profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={info.profile.avatarUrl}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-teal-200"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-2xl font-bold text-teal-700 ring-2 ring-teal-200">
                      {info.profile.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="text-lg font-semibold text-slate-900">{info.profile.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {info.canWrite
                      ? "Вы сможете просматривать и добавлять документы"
                      : "Только просмотр документов"}
                  </p>
                </div>

                {acceptErr && (
                  <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900 ring-1 ring-red-200">
                    {acceptErr === "Cannot accept your own family's invite"
                      ? "Нельзя принять приглашение на профиль своей же семьи."
                      : acceptErr}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="mt-6 w-full rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845] disabled:opacity-50"
                >
                  {accepting
                    ? "Принятие…"
                    : isAuthenticated
                      ? "Принять и открыть профиль"
                      : "Войти и принять приглашение"}
                </button>
              </>
            )}

            {accepted && (
              <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <p className="font-semibold">Доступ принят!</p>
                <p className="mt-1 text-xs">
                  Профиль <strong>{info?.profile.displayName}</strong> появится в переключателе
                  профилей. Переходим в приложение…
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function JoinFamilyByCodePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 to-white px-6">
          <p className="text-sm text-slate-500">Загрузка…</p>
        </main>
      }
    >
      <JoinFamilyByCodePageInner />
    </Suspense>
  );
}
