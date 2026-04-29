# SakBol (`sakbol_app_no2`)

Next.js 14 + Prisma + Telegram Mini App. Обработчик бота находится **в этом репозитории**: `app/api/telegram/webhook/route.ts` (отдельного проекта «бот» нет).

**Руководство пользователя** (пациент, семья, врач по шарингу, аптека): [docs/USER_GUIDE.md](./docs/USER_GUIDE.md).

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

## Webhook после деплоя (пункт 2)

Целевой URL: `https://<ваш-домен>/api/telegram/webhook`.

**Вариант A — уже задеплоено на Vercel** (токены в Project Settings → Environment Variables): один POST с сервера не нужен локально. Вызовите защищённый эндпоинт (в Vercel должны быть `BOT_INTERNAL_SECRET`, `TELEGRAM_BOT_TOKEN`, при необходимости `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` или `VERCEL_URL`):

```bash
curl -sS -X POST "https://<ваш-домен>/api/internal/telegram-set-webhook" \
  -H "Authorization: Bearer <BOT_INTERNAL_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

При неверном origin укажите явно: `-d '{"baseUrl":"https://your-domain.vercel.app"}'`.

**Вариант B — локально из репозитория:**

```bash
export WEBHOOK_BASE_URL="https://your-domain.vercel.app"
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_WEBHOOK_SECRET="..."
npm run telegram:set-webhook
```

**Вариант C — GitHub Actions:** в репозитории → *Settings → Secrets* добавьте `TELEGRAM_BOT_TOKEN` (и по желанию `TELEGRAM_WEBHOOK_SECRET`). Запустите workflow **Set Telegram webhook**, введите публичный `base_url`.

## Сборка

`npm run build` запускает `prisma generate`, затем `prisma migrate deploy`, затем `next build`. Если на сборке нет БД, задайте `SKIP_PRISMA_MIGRATE_ON_BUILD=1` и выполняйте миграции отдельно.

## Совместный доступ (QR)

Получатель должен открыть `t.me/<бот>?start=share_<token>` или Mini App с `startapp=share_<token>`. После входа чужой профиль появляется в переключателе (данные с `/api/family/default`).
