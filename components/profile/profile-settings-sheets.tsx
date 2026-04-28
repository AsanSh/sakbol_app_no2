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
      <p className="text-sm text-[#40484c]">
        Здесь будут настройки оповещений о SakBol.app: напоминания о приёме, статусы расшифровки
        анализов, семейный доступ и сервисные сообщения.
      </p>
      <Section title="Что планируется">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Push-уведомления в мобильном приложении и Mini App (при поддержке платформы).</li>
          <li>Сообщения от Telegram-бота (код входа, приглашения в семью, важные алерты).</li>
          <li>Выбор типов уведомлений: только срочные или также маркетинговые новости сервиса.</li>
        </ul>
      </Section>
      <p className="rounded-xl bg-[#f8f9fa] px-3 py-2 text-xs text-[#70787d]">
        Сейчас критичные действия (вход, приглашения) приходят через Telegram. Полноценный
        переключатель каналов появится в одном из ближайших обновлений — мы уведомим в приложении.
      </p>
    </div>
  );
}

/** Политика конфиденциальности + условия (SakBol.app) */
export function ProfilePrivacyContent() {
  return (
    <div className="max-h-[65dvh] space-y-6 overflow-y-auto pr-1">
      <p className="text-xs text-[#70787d]">Последнее обновление: 28 апреля 2026 г.</p>

      <div>
        <h3 className="mb-2 text-base font-bold text-[#004253]">Политика конфиденциальности</h3>
        <p className="text-sm leading-relaxed text-[#40484c]">
          Настоящая Политика конфиденциальности описывает, как <strong>SakBol.app</strong> собирает,
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
          <li>Данные о ваших анализах и документах, которые вы загружаете в приложение.</li>
          <li>Информацию о вашем использовании приложения и сайта.</li>
        </ul>
      </Section>

      <Section title="Хранение данных">
        <p>
          Мы храним ваши данные на защищённых серверах и принимаем необходимые меры для обеспечения
          их безопасности. Сведения об анализах и документах обрабатываются с учётом минимизации
          персональных данных; в интерфейсе и выгрузках по возможности используются псевдо-ID вместо
          ФИО.
        </p>
      </Section>

      <Section title="Передача данных третьим лицам">
        <p>
          Мы не продаём, не обмениваем и не передаём ваши личные данные третьим лицам без вашего
          согласия, за исключением случаев, когда это необходимо для предоставления запрошенных вами
          услуг или когда это требуется по закону.
        </p>
      </Section>

      <Section title="AI-обработка данных">
        <p>
          <strong>SakBol.app</strong> использует технологии искусственного интеллекта для чат-ассистента
          и анализа здоровья (в т.ч. расшифровки загруженных анализов). При использовании ассистента
          ваши сообщения, данные профиля здоровья (возраст, показатели и т.д.) и прикреплённые
          документы могут передаваться внешним AI-провайдерам для генерации ответов. Мы стремимся
          получать ваше явное согласие там, где это требуется. Провайдеры по договору обязаны
          применять меры защиты данных, сопоставимые с нашими.
        </p>
      </Section>

      <Section title="Безопасность">
        <p>
          Мы принимаем разумные меры для защиты вашей личной информации от несанкционированного
          доступа, использования или раскрытия. Ни один метод передачи через Интернет или
          электронного хранения не является абсолютно безопасным на 100%.
        </p>
      </Section>

      <Section title="Файлы cookie">
        <p>
          Наш сайт может использовать файлы cookie для улучшения пользовательского опыта. Вы можете
          настроить браузер на отклонение cookie; часть функций при этом может работать ограниченно.
        </p>
      </Section>

      <Section title="Изменения в политике конфиденциальности">
        <p>
          Мы можем обновлять Политику время от времени. О существенных изменениях сообщим в
          приложении или на сайте и обновим дату «Последнее обновление» в начале документа.
        </p>
      </Section>

      <Section title="Контакты (конфиденциальность)">
        <p>
          Вопросы по Политике:{" "}
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
          Пожалуйста, внимательно прочитайте эти Условия использования перед использованием приложения{" "}
          <strong>SakBol.app</strong>.
        </p>
      </div>

      <Section title="1. Принятие условий">
        <p>
          Используя SakBol.app, вы соглашаетесь соблюдать настоящие Условия. Если вы не согласны с
          какой-либо частью условий, вы не можете использовать наше приложение.
        </p>
      </Section>

      <Section title="2. Изменения условий">
        <p>
          Мы оставляем за собой право изменять или заменять эти Условия. При существенных изменениях
          постараемся уведомить вас заблаговременно (например, за 30 дней до вступления в силу), если
          это применимо.
        </p>
      </Section>

      <Section title="3. Учётная запись пользователя">
        <p>
          Для части функций необходима учётная запись. Вы несёте ответственность за конфиденциальность
          учётных данных и ограничение доступа к устройству.
        </p>
      </Section>

      <Section title="4. Интеллектуальная собственность">
        <p>
          Приложение SakBol.app, его контент, функции и функциональность являются собственностью
          правообладателя сервиса и защищены применимым законодательством.
        </p>
      </Section>

      <Section title="5. Ограничение ответственности">
        <p>
          SakBol.app не несёт ответственности за любые прямые, косвенные, случайные или последующие
          убытки, возникшие в результате использования или невозможности использования приложения, в
          пределах, допускаемых законом.
        </p>
      </Section>

      <Section title="6. Подписка и оплата">
        <p className="mb-2">Тарифы (ориентировочно, могут уточняться в приложении):</p>
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
          Подписка может автоматически продлеваться до отмены. После пробного периода с платёжного
          метода может списываться полная стоимость выбранного тарифа. Для отмены или вопросов по
          оплате напишите на{" "}
          <a className="font-semibold text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
            {SAKBOL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="7. Медицинская информация">
        <p>
          Информация в SakBol.app носит справочный характер и не заменяет очную консультацию врача,
          диагноз или лечение. По вопросам здоровья обращайтесь к квалифицированным специалистам.
        </p>
      </Section>

      <Section title="8. Прекращение действия">
        <p>
          Мы можем приостановить или прекратить доступ к приложению в случае нарушения Условий или по
          иным основаниям, предусмотренным законом.
        </p>
      </Section>

      <Section title="9. Применимое право">
        <p>Настоящие Условия регулируются применимым законодательством.</p>
      </Section>

      <Section title="10. Контакты (условия)">
        <p>
          Вопросы по Условиям:{" "}
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
  /** ID профиля / пользователя для обращения */
  userId: string | null;
  /** Клинический псевдо-ID для отображения */
  clinicalLabel: string | null;
};

/** Форма обращения в поддержку (mailto) */
export function ProfileSupportForm({ userId, clinicalLabel }: SupportProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const attachmentBlock =
    userId || clinicalLabel
      ? `\n\n---\nID профиля (техн.): ${userId ?? "—"}\nПсевдо-ID (клинический): ${clinicalLabel ?? "—"}`
      : "\n\n---\nПользователь не авторизован — укажите email/Telegram в тексте.";

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
      <p className="text-sm text-[#70787d]">Опишите вашу проблему или вопрос — откроется почта.</p>

      <div className="rounded-xl bg-[#f8f9fa] px-3 py-3 text-xs ring-1 ring-[#e7e8e9]">
        <p className="font-semibold text-[#191c1d]">ID пользователя (профиль)</p>
        <p className="mt-1 break-all font-mono text-[11px] text-[#40484c]">{userId ?? "—"}</p>
        {clinicalLabel ? (
          <p className="mt-2 font-mono text-[11px] text-[#70787d]">
            Псевдо-ID: {clinicalLabel}
          </p>
        ) : null}
        <p className="mt-2 text-[10px] text-[#70787d]">
          Эти идентификаторы будут добавлены в текст письма при отправке.
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
            "outline-none ring-[#004253] focus-visible:ring-2",
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
          rows={5}
          className={cn(
            "mt-1 w-full resize-y rounded-xl border border-[#e7e8e9] bg-white px-3 py-2.5 text-sm text-[#191c1d]",
            "outline-none ring-[#004253] focus-visible:ring-2",
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
        className="w-full rounded-xl bg-[#191c1d] py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
      >
        Отправить обращение
      </button>

      <p className="text-center text-[11px] text-[#70787d]">
        Напрямую:{" "}
        <a className="text-[#004253] underline" href={`mailto:${SAKBOL_SUPPORT_EMAIL}`}>
          {SAKBOL_SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
