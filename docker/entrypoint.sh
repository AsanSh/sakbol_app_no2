#!/bin/sh
set -e
# docker compose run web npx prisma … — выполнить команду без migrate+start
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
echo "[entrypoint] prisma migrate deploy…"
npx prisma migrate deploy
echo "[entrypoint] starting Next.js…"
exec npm run start
