# SakBol (`sakbol_app_no2`)

Next.js 15 + Prisma + Telegram Mini App. Обработчик бота находится **в этом репозитории**: `app/api/telegram/webhook/route.ts` (отдельного проекта «бот» нет).

**Руководство пользователя** (пациент, семья, врач по шарингу, аптека): [docs/USER_GUIDE.md](./docs/USER_GUIDE.md).

Вкладки в приложении: **Главная** · **Анализы** · **Обзор** (динамика + ИИ) · **Пациенты** (совместный доступ / «мои пациенты») · **Фармпоиск** (запросы и кабинет аптеки) · **Профиль**.

## Локально

Скопируйте `.env.example` → `.env`, поднимите Postgres (`docker compose up -d`), затем:

```bash
npm install
npm run db:local
npm run dev
```

## Переменные окружения (шаринг профиля)

- `TELEGRAM_BOT_TOKEN` — токен бота.
- `TELEGRAM_WEBHOOK_SECRET` — секрет для заголовка `X-Telegram-Bot-Api-Secret-Token` у webhook.
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — опционально (без `@`). Если не задан, QR «совместного доступа» запрашивает username через `GET /api/public/telegram-bot-username`.
- `DATABASE_URL`, `SESSION_SECRET` — см. `.env.example`.

## Вход: Telegram, email, телефон

- **Mini App / Telegram:** вход по `initData`; после входа можно привязать **email + пароль** или **номер** для входа на сайте (модальное окно или раздел в профиле).
- **Сайт `/login`:** код из Telegram (по @username, id или сохранённому номеру) или **email + пароль**, если они привязаны к профилю.

## Webhook после деплоя

Целевой URL: `https://adventory.store/api/telegram/webhook` (см. [docs/SELF_HOSTED.md](./docs/SELF_HOSTED.md)).

**На сервере:**

```bash
export WEBHOOK_BASE_URL="https://adventory.store"
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_WEBHOOK_SECRET="..."
npm run telegram:set-webhook
```

**Или внутренний API** (нужны `BOT_INTERNAL_SECRET`, токены бота):

```bash
curl -sS -X POST "https://adventory.store/api/internal/telegram-set-webhook" \
  -H "Authorization: Bearer <BOT_INTERNAL_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://adventory.store"}'
```

**GitHub Actions:** workflow **Set Telegram webhook** + секрет `TELEGRAM_BOT_TOKEN`.

## Сборка

`npm run build` запускает `prisma generate`, затем `prisma migrate deploy`, затем `next build`. Если на сборке нет БД, задайте `SKIP_PRISMA_MIGRATE_ON_BUILD=1` и выполняйте миграции отдельно.

## Продакшен (VPS)

См. [docs/SELF_HOSTED.md](./docs/SELF_HOSTED.md): `docker compose -f docker-compose.selfhosted.yml up -d --build`.

## Совместный доступ (QR)

Получатель должен открыть `t.me/<бот>?start=share_<token>` или Mini App с `startapp=share_<token>`. После входа чужой профиль появляется в переключателе (данные с `/api/family/default`).
