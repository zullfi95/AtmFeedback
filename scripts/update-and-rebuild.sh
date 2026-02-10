#!/bin/bash
# Обновление FeedbackATM из Git и пересборка контейнеров на сервере.
# Запуск: из /opt/mintstudio или: cd /opt/mintstudio && ./FeedbackATM/scripts/update-and-rebuild.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEEDBACK_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_DIR="$(dirname "$FEEDBACK_DIR")"

echo "=== FeedbackATM: git pull ==="
cd "$FEEDBACK_DIR"
git fetch origin main
git reset --hard origin/main

echo "=== Rebuild containers ==="
cd "$COMPOSE_DIR"
docker compose -f docker-compose.all.yml up -d --build feedbackatm-backend feedbackatm-frontend

echo "=== Done ==="
docker compose -f docker-compose.all.yml ps feedbackatm-backend feedbackatm-frontend
