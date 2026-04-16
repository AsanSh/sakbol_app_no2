"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { askLabAssistantFromBook } from "@/app/actions/lab-assistant";
import { useActiveProfile } from "@/context/active-profile-context";

type Msg = { id: string; role: "user" | "assistant"; text: string; time: string };

const FAQ = [
  "Что такое ЛПНП?",
  "Как подготовиться к анализу крови?",
  "Норма глюкозы натощак",
];

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function AiTab() {
  const { activeProfileId } = useActiveProfile();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "0",
      role: "assistant",
      text: "Здравствуйте! Ответы собираются из справочника по лабораторным анализам (Хиггинс и др.), загруженного в проект. Напишите показатель или вопрос — подберём близкие фрагменты текста. Это не диагноз и не замена врачу.",
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

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
    });
  }, [pending, activeProfileId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SakbolTopBar
        title="ИИ"
        rightSlot={
          <span className="flex items-center gap-1.5 rounded-full border border-[#d4e6e9] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#004253]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#004253] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#004253]" />
            </span>
            Онлайн
          </span>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4">
        <div className="rounded-2xl border border-[#e7e8e9] bg-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
              <MaterialIcon name="smart_toy" filled className="text-[24px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-manrope font-bold text-[#191c1d]">Sakbol ИИ</p>
                <span className="flex items-center gap-0.5 rounded-full bg-[#d4e6e9]/60 px-2 py-0.5 text-[9px] font-semibold text-[#004253]">
                  <MaterialIcon name="menu_book" className="text-[14px]" filled />
                  Справочник Хиггинс
                </span>
              </div>
              <p className="text-xs text-[#70787d]">
                Поиск по книге; к запросу подмешивается последний анализ выбранного профиля (семья)
              </p>
            </div>
          </div>
        </div>

        {messages.length === 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FAQ.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-[#e7e8e9] bg-white px-3 py-1.5 text-[11px] font-medium text-[#40484c] shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto pb-2 md:min-h-[18rem]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
                  <MaterialIcon name="smart_toy" className="text-[16px]" filled />
                </div>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  m.role === "user"
                    ? "rounded-br-sm bg-gradient-to-br from-[#004253] to-[#005b71] text-white"
                    : "rounded-bl-sm border border-[#e7e8e9] bg-white text-[#191c1d]",
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
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
          {pending ? (
            <div className="flex items-center gap-1 pl-10 text-[#70787d]">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce [animation-delay:0.15s]">●</span>
              <span className="animate-bounce [animation-delay:0.3s]">●</span>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-[#e7e8e9] bg-[#f8f9fa]/90 py-2 backdrop-blur-md">
          <div className="flex items-end gap-2 rounded-2xl border border-[#e7e8e9] bg-white p-2 shadow-sm">
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
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[#191c1d] outline-none placeholder:text-[#70787d]"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={pending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white shadow-sm disabled:opacity-50"
              aria-label="Отправить"
            >
              <MaterialIcon name="send" className="text-[20px]" filled />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
