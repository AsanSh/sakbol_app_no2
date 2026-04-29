# Развёртывание SakBol на своём VPS (Ubuntu + Docker + домен)

Тариф уровня **4 vCPU / 6 GB RAM** (как RU-KVM-5) более чем достаточен для Next.js, PostgreSQL и загрузки файлов.

## Что получится

- **PostgreSQL 16** в Docker, данные в volume.
- **Next.js** в Docker, слушает только `127.0.0.1:3000` (снаружи не торчит).
- **nginx + Let’s Encrypt** на хосте — HTTPS и прокси на приложение.
- Файлы документов и лабораторий — на диске VPS (`SAKBOL_DATA_DIR`, volume `sakbol_data`), без Vercel Blob.

## 1. Сервер

1. Установите Ubuntu 22.04 (у вас уже есть).
2. Создайте пользователя для деплоя (не работайте постоянно под `root`):

   ```bash
   adduser deploy
   usermod -aG sudo deploy
   ```

3. По SSH лучше **ключ**, а не пароль: добавьте свой `~/.ssh/id_ed25519.pub` в `~/.ssh/authorized_keys` на сервере.

## 2. Docker

На сервере:

```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

Перелогиньтесь, чтобы группа `docker` применилась.

## 3. Код и секреты

```bash
sudo mkdir -p /opt/sakbol && sudo chown deploy:deploy /opt/sakbol
cd /opt/sakbol
git clone https://github.com/AsanSh/sakbol_app_no2.git .
cp .env.example .env.production
nano .env.production
```

Файл **`docker-compose.yml`** в репозитории — только Postgres для локальной разработки (порт 5432). На VPS используйте **`docker-compose.selfhosted.yml`**.

Обязательно заполните как минимум:

| Переменная | Зачем |
|------------|--------|
| `POSTGRES_PASSWORD` | Пароль БД (для `docker compose`) |
| `NEXT_PUBLIC_APP_URL` и `APP_URL` | `https://adventory.store` |
| `WEBHOOK_BASE_URL` | Тот же URL (для webhook-скрипта) |
| `TELEGRAM_BOT_TOKEN` | Бот |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для проверки webhook |
| `BOT_INTERNAL_SECRET` | Внутренние роуты бота |
| `SESSION_SECRET` | Длинная случайная строка |
| `PIN_ANCHOR_PEPPER` | ≥16 символов |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Имя бота без `@` |
| `CRON_SECRET` | Случайная строка для cron-эндпоинта |
| `GEMINI_API_KEY` | Если нужен разбор анализов |

**Важно:** при переносе **существующих** пользователей с Vercel значения `SESSION_SECRET` и `PIN_ANCHOR_PEPPER` должны совпадать с продом, иначе всем придётся войти заново и перепривязать ПИН.

В продакшене отключите демо-логин:

```env
ALLOW_DEV_LOGIN="false"
NEXT_PUBLIC_ALLOW_DEV_LOGIN="false"
```

`DATABASE_URL` внутри контейнера `web` задаётся в `docker-compose.selfhosted.yml` — строку Neon в `.env.production` можно удалить или оставить комментарием, чтобы не путаться.

## 4. Запуск стека

Из `/opt/sakbol`:

Docker Compose подставляет `${POSTGRES_PASSWORD}` в YAML из файла **`.env`** в корне проекта (не путать с `env_file` у сервисов). Поэтому один раз сделайте symlink:

```bash
ln -sf .env.production .env
docker compose -f docker-compose.selfhosted.yml up -d --build
```

При старте контейнер выполнит `prisma migrate deploy`, затем `next start`.

Проверка:

```bash
curl -sS http://127.0.0.1:3000/ | head
docker compose -f docker-compose.selfhosted.yml logs -f web
```

Первый раз при необходимости:

```bash
docker compose -f docker-compose.selfhosted.yml exec web npx tsx prisma/seed.ts
```

(только если нужен демо-админ из seed; пароль задайте через `SEED_ADMIN_*` в `.env.production` до seed.)

## 5. Домен и HTTPS (nginx)

1. В DNS у регистратора: **A-запись** `@` → IP VPS, при необходимости `www` → тот же IP.
2. Установите nginx и certbot:

   ```bash
   sudo apt -y install nginx certbot python3-certbot-nginx
   ```

3. Скопируйте пример и подставьте домен:

   ```bash
   sudo cp infra/nginx-sakbol.conf.example /etc/nginx/sites-available/sakbol
   sudo nano /etc/nginx/sites-available/sakbol
   sudo ln -sf /etc/nginx/sites-available/sakbol /etc/nginx/sites-enabled/
   sudo nginx -t
   ```

4. Получите сертификат (замените домен и email):

   ```bash
   sudo certbot --nginx -d adventory.store -d www.adventory.store
   ```

5. Перезагрузка nginx:

   ```bash
   sudo systemctl reload nginx
   ```

Сайт должен открываться по `https://adventory.store`.

## 6. Telegram

1. **Webhook** на новый URL:

   ```bash
   cd /opt/sakbol
   docker compose -f docker-compose.selfhosted.yml exec web npx tsx scripts/set-telegram-webhook.ts
   ```

   Либо вызовите ваш защищённый роут `POST /api/internal/telegram-set-webhook` с `BOT_INTERNAL_SECRET`, если так настроено.

2. В **@BotFather** для Mini App укажите URL: `https://adventory.store` (кнопка меню / Web App).

## 7. Cron (истечение заявок на лекарства)

На хосте (не в контейнере), от пользователя с `curl`:

```bash
sudo crontab -e
```

Строка (подставьте домен и секрет из `CRON_SECRET`):

```cron
0 * * * * curl -fsS -H "Authorization: Bearer ВАШ_CRON_SECRET" "https://adventory.store/api/cron/expire-medicine-requests" >/dev/null 2>&1
```

## 8. Перенос данных с Vercel / Neon

1. **БД:** с Neon (или другого Postgres) сделайте дамп и восстановите в контейнер:

   ```bash
   # на машине с доступом к старой БД
   pg_dump "$OLD_DATABASE_URL" -Fc -f sakbol.dump

   # на VPS
   docker compose -f docker-compose.selfhosted.yml cp sakbol.dump db:/tmp/sakbol.dump
   docker compose -f docker-compose.selfhosted.yml exec db pg_restore -U sakbol -d sakbol --clean --if-exists /tmp/sakbol.dump
   ```

   Имена `-U` / `-d` должны совпасть с `POSTGRES_USER` / `POSTGRES_DB`.

2. **Файлы из Vercel Blob:** если в БД есть URL на `blob.vercel-storage.com`, их нужно отдельно выгрузить и положить в логику хранения или оставить как внешние URL (редиректы продолжат работать). Новые файлы без `BLOB_READ_WRITE_TOKEN` пишутся в `SAKBOL_DATA_DIR`.

## 9. Обновление приложения

```bash
cd /opt/sakbol
git pull
ln -sf .env.production .env
docker compose -f docker-compose.selfhosted.yml up -d --build
```

## 10. Не передавайте пароли в чатах

Доступ по SSH выдаёте через **ключ** или одноразовый пароль, который сразу меняете. Токены бота и `SESSION_SECRET` храните только в `.env.production` на сервере.
