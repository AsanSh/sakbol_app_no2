"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { FamilyRole } from "@prisma/client";
import { AddMemberModal } from "@/components/add-member-modal";
import { FamilySwitcher } from "@/components/family-switcher";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { askLabAssistantFromBook } from "@/app/actions/lab-assistant";
import { MedicalHistoryAnalysisCard } from "@/components/sakbol/ai/medical-history-card";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import type { FamilyWithProfiles } from "@/types/family";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  streaming?: boolean;
};

type Lang = "Russian" | "Kyrgyz" | "English";
const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "Russian", label: "RU" },
  { value: "Kyrgyz", label: "KG" },
  { value: "English", label: "EN" },
];

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

const INTRO_ASSISTANT =
  "Здравствуйте! Чем могу помочь по вашим анализам? Вы также можете прикрепить фото или скан медицинского документа для AI-анализа.";

type Props = {
  family: FamilyWithProfiles | null;
  reloadFamily: () => void;
};

export function AiTab({ family, reloadFamily }: Props) {
  const { activeProfileId } = useActiveProfile();
  const { authReady, isAuthenticated } = useTelegramSession();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: "0", role: "assistant", text: INTRO_ASSISTANT, time: nowTime() },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [lang, setLang] = useState<Lang>("Russian");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || imageAnalyzing) return;

      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed, time: nowTime() };
      setMessages((m) => [...m, userMsg]);
      setInput("");

      startTransition(async () => {
        const res = await askLabAssistantFromBook(trimmed, activeProfileId);
        const reply = res.ok ? res.answer : res.error;
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: reply, time: nowTime() },
        ]);
        scrollToBottom();
      });
    },
    [pending, imageAnalyzing, activeProfileId, scrollToBottom],
  );

  const analyzeImage = useCallback(
    async (file: File) => {
      if (imageAnalyzing || pending) return;
      setImageAnalyzing(true);

      const userMsg: Msg = {
        id: crypto.randomUUID(),
        role: "user",
        text: `📎 ${file.name}`,
        time: nowTime(),
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Msg = {
        id: assistantId,
        role: "assistant",
        text: "",
        time: nowTime(),
        streaming: true,
      };

      setMessages((m) => [...m, userMsg, assistantMsg]);
      scrollToBottom();

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("targetLanguage", lang);

        const res = await fetch("/api/ai/analyze-image", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({ error: `Ошибка ${res.status}` })) as { error?: string };
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: j.error ?? "Ошибка анализа.", streaming: false }
                : msg,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snapshot = accumulated;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, text: snapshot, streaming: true } : msg,
            ),
          );
          scrollToBottom();
        }

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, text: accumulated, streaming: false } : msg,
          ),
        );
      } catch (e) {
        const errText = e instanceof Error ? e.message : "Ошибка сети.";
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, text: errText, streaming: false } : msg,
          ),
        );
      } finally {
        setImageAnalyzing(false);
        scrollToBottom();
      }
    },
    [imageAnalyzing, pending, lang, scrollToBottom],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        analyzeImage(file);
        e.target.value = "";
      }
    },
    [analyzeImage],
  );

  const isBusy = pending || imageAnalyzing;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SakbolTopBar
        title="ИИ"
        centerSlot={headerSwitcher}
        rightSlot={
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-[#d4e6e9] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#004253] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004253]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#004253] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#004253]" />
              </span>
              {lang}
              <span className="text-[8px] opacity-60">▾</span>
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-8 z-50 overflow-hidden rounded-xl border border-[#e7e8e9] bg-white shadow-lg">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setLang(opt.value); setShowLangMenu(false); }}
                    className={cn(
                      "block w-full px-4 py-2 text-left text-xs font-medium hover:bg-[#f0f9ff]",
                      lang === opt.value ? "text-[#004253] font-semibold" : "text-[#70787d]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-3 pb-0">
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex min-h-full flex-col justify-end gap-2 py-1">
          <div className="pt-1">
            <MedicalHistoryAnalysisCard profileId={activeProfileId} />
          </div>
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
                    <MaterialIcon name="smart_toy" className="text-[16px]" filled />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-gradient-to-br from-[#004253] to-[#005b71] text-white"
                      : "rounded-bl-sm border border-[#e7e8e9] bg-white text-[#191c1d]",
                  )}
                >
                  {m.role === "assistant" && m.streaming && !m.text ? (
                    <div className="flex items-center gap-1.5 py-1 text-[#70787d]">
                      <span className="animate-bounce text-lg leading-none">●</span>
                      <span className="animate-bounce text-lg leading-none [animation-delay:0.15s]">●</span>
                      <span className="animate-bounce text-lg leading-none [animation-delay:0.3s]">●</span>
                      <span className="ml-1 text-xs">Анализирую…</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.role === "assistant" && m.streaming && m.text && (
                    <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-[#004253] align-middle" />
                  )}
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      m.role === "user" ? "text-white/70" : "text-[#70787d]",
                    )}
                  >
                    {m.time}
                  </p>
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex items-center gap-1.5 pl-10 text-[#70787d]">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:0.15s]">●</span>
                <span className="animate-bounce [animation-delay:0.3s]">●</span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#e7e8e9] bg-[#f8f9fa]/95 py-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md">
          <div className="flex items-end gap-2 rounded-2xl border border-[#e7e8e9] bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-[#004253]/30">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={onFileChange}
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              title="Прикрепить документ или фото"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e7e8e9] text-[#70787d] transition hover:bg-[#f0f9ff] hover:text-[#004253] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004253]"
            >
              <MaterialIcon name="attach_file" className="text-[20px]" />
            </button>

            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="Сообщение…"
              disabled={isBusy}
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[#191c1d] outline-none placeholder:text-[#70787d] disabled:opacity-60"
            />

            <button
              type="button"
              onClick={() => send(input)}
              disabled={isBusy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white shadow-sm transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004253]"
              aria-label="Отправить"
            >
              <MaterialIcon name="send" className="text-[20px]" filled />
            </button>
          </div>
        </div>
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
