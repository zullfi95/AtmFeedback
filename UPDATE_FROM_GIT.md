# Обновление FeedbackATM на сервере

## Вариант 1: С вашего ПК (рекомендуется)

На сервере не нужен доступ к GitHub. Обновляете код у себя и отправляете его на сервер скриптом:

```powershell
cd E:\MintStudio\FeedbackATM

# Подтянуть последние изменения из GitHub
git pull origin main

# Задеплоить на сервер (SCP + пересборка контейнеров)
.\deploy-atm.ps1
```

Или только бэкенд:
```powershell
git pull origin main
.\deploy-backend.ps1
```

---

## Вариант 2: Прямо на сервере (через git pull)

Чтобы обновляться командой `git pull` на сервере, один раз настройте доступ к GitHub.

### 2.1 Репозиторий публичный

На сервере:

```bash
cd /opt/mintstudio/FeedbackATM
git init
git remote add origin https://github.com/zullfi95/AtmFeedback.git
git fetch origin main
git reset --hard origin/main
cp /tmp/feedbackatm-backend.env backend/.env   # если бэкапили .env
cd /opt/mintstudio && docker compose -f docker-compose.all.yml up -d --build feedbackatm-backend feedbackatm-frontend
```

Дальше при обновлении:
```bash
cd /opt/mintstudio/FeedbackATM
git pull origin main
cd /opt/mintstudio && docker compose -f docker-compose.all.yml up -d --build feedbackatm-backend feedbackatm-frontend
```

### 2.2 Репозиторий приватный

1. На сервере сгенерировать SSH-ключ (если нет):  
   `ssh-keygen -t ed25519 -C "server" -f ~/.ssh/id_ed25519 -N ""`
2. Добавить в GitHub: **Settings → Deploy keys** у репозитория AtmFeedback, вставить содержимое `~/.ssh/id_ed25519.pub`.
3. В `/opt/mintstudio/FeedbackATM` настроить remote по SSH и делать `git pull` + пересборку как в 2.1, но с `origin` = `git@github.com:zullfi95/AtmFeedback.git`.

После первой настройки обновление с сервера — это `git pull` и пересборка контейнеров.
