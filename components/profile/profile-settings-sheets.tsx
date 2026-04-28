"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SAKBOL_SUPPORT_EMAIL = "support@sakbol.app";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-[#191c1d]">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-[#40484c]">{children}</div>
    </section>
  );
}

/** Вкладка «Уведомления» */
export function ProfileNotificationsContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#70787d]">
        Здесь настраиваются оповещения SakBol: напоминания, статусы расшифровки анализов и сервисные
        сообщения.
      </p>
      <Section title="Каналы">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Telegram.</strong> Код входа, приглашения в семью, ответы бота — уже приходят в
            чат с ботом при использовании Mini App.
          </li>
          <li>
            <strong>Push (мобильное приложение).</strong> Появятся в релизе нативного клиента; сейчас
            основной канал — Telegram.
          </li>
          <li>
            <strong>Email.</strong> Сервисные письма при входе через сайт и смене важных настроек (если
            указали почту).
          </li>
        </ul>
      </Section>
      <Section title="Типы уведомлений (план)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Готовность расшифровки анализа и ошибки загрузки.</li>
          <li>Напоминания о приёме лекарств (если включите в профиле).</li>
          <li>Семейный доступ: приглашения и отзывы доступа.</li>
          <li>Новости продукта — только если включите маркетинговую рассылку (отдельный переключатель).</li>
        </ul>
      </Section>
      <p className="rounded-xl bg-[#f8f9fa] px-3 py-2 text-xs text-[#70787d]">
        Полноценные переключатели «вкл/выкл» по категориям появятся в ближайших обновлениях. Сейчас
        критичные события дублируются в Telegram и в списке ниже на главной (колокольчик).
      </p>
    </div>
  );
}

/** Политика конфиденциальности + условия (SakBol) */
export function ProfilePrivacyContent() {
  return (
    <div className="max-h-[65dvh] space-y-6 overflow-y-auto pr-1">
      <p className="text-xs font-medium text-[#70787d]">Последнее обновление: 1 апреля 2026 г.</p>

      <div>
        <h3 className="mb-2 text-base font-bold text-[#004253]">Политика конфиденциальности</h3>
        <p className="text-sm leading-relaxed text-[#40484c]">
          Настоящая Политика конфиденциальности описывает, как <strong>SakBol</strong> собирает,
          использует и раскрывает вашу информацию при использовании нашего сайта и мобильного
          приложения.
        </p>
      </div>

      <Section title="Сбор и использование информации">
        <p>Для улучшения работы нашего сервиса мы можем собирать различные типы информации, включая:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Личную информацию, такую как имя, адрес электронной почты и другие контактные данные.
          </li>
          <li>
            Информацию о вашем устройстве, включая модель устройства, операционную систему и версию
            приложения.
          </li>
          <li>Данные о ваших анализах, которые вы загружаете в приложение.</li>
          <li>Информацию о вашем использовании приложения и сайта.</li>
        </ul>
      </Section>

      <Section title="Хранение данных">
        <p>
          Мы храним ваши данные на защищенных серверах и принимаем все необходимые меры для обеспечения
          их безопасности. Данные о ваших анализах хранятся в зашифрованном виде и доступны только вам.
        </p>
      </Section>

      <Section title="Передача данных третьим лицам">
        <p>
          Мы не продаем, не обмениваем и не передаем ваши личные данные третьим лицам без вашего
          согласия, за исключением случаев, когда это необходимо для предоставления запрошенных вами
          услуг или когда это требуется по закону.
        </p>
      </Section>

      <Section title="AI-обработка данных">
        <p>
          <strong>SakBol</strong> использует нейросетевые модели для чат-ассистента и разбора
          медицинских документов (в т.ч. распознавание показателей анализов). При использовании этих
          функций ваши сообщения, данные профиля здоровья (возраст, лекарства и т.д.) и прикреплённые
          файлы (PDF, снимки анализов) могут передаваться внешним AI-провайдерам — например{" "}
          <strong>OpenAI</strong> и <strong>Google (Gemini)</strong> — в объёме, необходимом для ответа
          или обработки файла. Конкретный провайдер может меняться по мере обновления сервиса; условия
          защиты данных закрепляются договором не ниже стандартов SakBol. Мы запрашиваем ваше явное
          согласие в приложении там, где это требуется, прежде чем отправить данные на обработку.
        </p>
      </Section>

      <Section title="Безопасность">
        <p>
          Мы принимаем разумные меры для защиты вашей личной информации от несанкционированного
          доступа, использования или раскрытия. Однако, помните, что ни один метод передачи через
          Интернет или метод электронного хранения не является на 100% безопасным.
        </p>
      </Section>

      <Section title="Файлы cookie">
        <p>
          Наш сайт использует файлы cookie для улучшения пользовательского опыта. Вы можете настроить
          свой браузер так, чтобы отклонять все файлы cookie или указывать, когда файл cookie
          отправляется. Однако, некоторые функции сайта могут не работать должным образом, если файлы
          cookie отключены.
        </p>
      </Section>

      <Section title="Изменения в политике конфиденциальности">
        <p>
          Мы можем обновлять нашу Политику конфиденциальности время от времени. Мы уведомим вас о любых
          изменениях, разместив новую Политику конфиденциальности на этой странице и обновив дату{" "}
          <q className="font-medium text-[#191c1d]">Последнее обновление</q> в верхней части этой Политики
          конфиденциальности.
        </p>
      </Section>

      <Section title="Контакты">
        <p>
          Если у вас есть вопросы или предложения относительно нашей Политики конфиденциальности,
          пожалуйста, свяжитесь с нами через поддержку <strong>SakBol</strong> по адресу{" "}
          <a className="font-semibold text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
            {SAKBOL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <hr className="border-[#e7e8e9]" />

      <div>
        <h3 className="mb-2 text-base font-bold text-[#004253]">Условия использования</h3>
        <p className="text-sm leading-relaxed text-[#40484c]">
          Пожалуйста, внимательно прочитайте эти Условия использования перед использованием сервиса{" "}
          <strong>SakBol</strong>.
        </p>
      </div>

      <Section title="1. Принятие условий">
        <p>
          Используя приложение SakBol, вы соглашаетесь соблюдать настоящие Условия использования.
          Если вы не согласны с какой-либо частью условий, вы не можете использовать наше приложение.
        </p>
      </Section>

      <Section title="2. Изменения условий">
        <p>
          Мы оставляем за собой право по своему усмотрению изменять или заменять эти Условия в любое
          время. Если изменение существенно, мы постараемся уведомить вас за 30 дней до вступления в
          силу новых условий.
        </p>
      </Section>

      <Section title="3. Учётная запись пользователя">
        <p>
          Для использования некоторых функций нашего приложения вам необходимо создать учётную запись.
          Вы несёте ответственность за сохранение конфиденциальности своей учётной записи и пароля, а
          также за ограничение доступа к своему устройству.
        </p>
      </Section>

      <Section title="4. Интеллектуальная собственность">
        <p>
          Приложение SakBol и его оригинальный контент, функции и функциональность являются и останутся
          исключительной собственностью правообладателя SakBol и его лицензиаров.
          Приложение защищено авторским правом, товарным знаком и другими законами.
        </p>
      </Section>

      <Section title="5. Ограничение ответственности">
        <p>
          SakBol не несёт ответственности за любые прямые, косвенные, случайные, особые или
          последующие убытки, возникшие в результате использования или невозможности использования
          приложения.
        </p>
      </Section>

      <Section title="6. Подписка и оплата">
        <div className="overflow-x-auto rounded-xl border border-[#e7e8e9]">
          <table className="w-full min-w-[280px] text-left text-xs">
            <thead className="bg-[#f8f9fa] text-[#191c1d]">
              <tr>
                <th className="px-3 py-2 font-semibold">Тариф</th>
                <th className="px-3 py-2 font-semibold">Цена</th>
                <th className="px-3 py-2 font-semibold">Пробный период</th>
              </tr>
            </thead>
            <tbody className="text-[#40484c]">
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-3 py-2">Месяц</td>
                <td className="px-3 py-2">699 ₽/мес</td>
                <td className="px-3 py-2">7 дней</td>
              </tr>
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-3 py-2">Год</td>
                <td className="px-3 py-2">4 490 ₽/год</td>
                <td className="px-3 py-2">7 дней</td>
              </tr>
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-3 py-2">Навсегда</td>
                <td className="px-3 py-2">14 990 ₽</td>
                <td className="px-3 py-2">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2">
          Подписка автоматически продлевается до отмены. После пробного периода с карты списывается
          полная стоимость выбранного тарифа. Для отмены подписки напишите на{" "}
          <a className="font-semibold text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
            {SAKBOL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="7. Медицинская информация">
        <p>
          Информация, предоставляемая в приложении SakBol, предназначена только для
          информационных целей и не заменяет профессиональную медицинскую консультацию, диагностику
          или лечение. Всегда консультируйтесь с квалифицированным медицинским специалистом по
          вопросам, касающимся вашего здоровья.
        </p>
      </Section>

      <Section title="8. Прекращение действия">
        <p>
          Мы можем прекратить или приостановить доступ к нашему приложению немедленно, без
          предварительного уведомления или ответственности, по любой причине, включая, без ограничений,
          нарушение Условий.
        </p>
      </Section>

      <Section title="9. Применимое право">
        <p>Настоящие Условия регулируются и толкуются в соответствии с применимым законодательством.</p>
      </Section>

      <Section title="10. Контакты">
        <p>
          Если у вас есть вопросы об этих Условиях, пожалуйста, свяжитесь с нами по адресу:{" "}
          <a className="font-semibold text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
            {SAKBOL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

type SupportProps = {
  userId: string | null;
  clinicalLabel: string | null;
};

/** Форма обращения в поддержку (mailto), как в макете */
export function ProfileSupportForm({ userId, clinicalLabel }: SupportProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const attachmentBlock =
    userId || clinicalLabel
      ? `\n\n---\nID пользователя: ${userId ?? "—"}` +
        (clinicalLabel ? `\nПсевдо-ID (клинический): ${clinicalLabel}` : "")
      : "\n\n---\nПользователь не авторизован — укажите email или Telegram в тексте.";

  const send = () => {
    const sub = subject.trim();
    const msg = body.trim();
    if (!sub || !msg) {
      setHint("Заполните тему и описание.");
      return;
    }
    setHint(null);
    const mailto = `mailto:${SAKBOL_SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[SakBol] ${sub}`,
    )}&body=${encodeURIComponent(msg + attachmentBlock)}`;
    window.location.href = mailto;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#70787d]">Опишите вашу проблему или вопрос</p>

      <div className="rounded-xl bg-[#f8f9fa] px-3 py-3 text-xs ring-1 ring-[#e7e8e9]">
        <p className="font-semibold text-[#191c1d]">ID пользователя:</p>
        <p className="mt-1 break-all font-mono text-[12px] font-medium text-[#191c1d]">
          {userId ?? "—"}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-[#70787d]">
          Этот идентификатор будет автоматически прикреплён к вашему обращению
          {clinicalLabel ? " (в письмо также добавляется псевдо-ID для врача)." : "."}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#40484c]" htmlFor="support-subject">
          Тема обращения
        </label>
        <input
          id="support-subject"
          className={cn(
            "mt-1 w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2.5 text-sm text-[#191c1d]",
            "placeholder:text-[#bfc8cc] outline-none ring-[#004253] focus-visible:ring-2",
          )}
          placeholder="Тема обращения"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#40484c]" htmlFor="support-body">
          Опишите вашу проблему или вопрос
        </label>
        <textarea
          id="support-body"
          rows={6}
          className={cn(
            "mt-1 w-full resize-y rounded-xl border border-[#e7e8e9] bg-white px-3 py-2.5 text-sm text-[#191c1d]",
            "placeholder:text-[#bfc8cc] outline-none ring-[#004253] focus-visible:ring-2",
          )}
          placeholder="Опишите вашу проблему или вопрос"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {hint ? (
        <p className="text-xs text-red-700" role="alert">
          {hint}
        </p>
      ) : null}

      <button
        type="button"
        onClick={send}
        className="w-full rounded-xl bg-[#191c1d] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-black"
      >
        Отправить обращение
      </button>

      <p className="text-center text-[11px] text-[#70787d]">
        Почта:{" "}
        <a className="font-medium text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
          {SAKBOL_SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
