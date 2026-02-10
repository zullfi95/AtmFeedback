#!/bin/bash
# Запускать на сервере после git pull. Требует: на сервере в backend/.env указан DATABASE_URL=postgresql://...

set -e
cd "$(dirname "$0")"

echo "=== Backend: install, Prisma, build ==="
cd backend
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
npx prisma generate
npx prisma db push
npm run build
cd ..

echo "=== Frontend: install, build ==="
cd frontend
npm ci 2>/dev/null || npm install
npm run build
cd ..

echo "=== Готово. Перезапусти backend (pm2/systemd/docker). ==="
