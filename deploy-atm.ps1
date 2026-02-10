# Синхронизация только FeedbackATM (backend + frontend) на сервер и перезапуск контейнеров
# Копирует только код (без node_modules). Затем docker compose up --build для feedbackatm-backend и feedbackatm-frontend.
# Usage: .\deploy-atm.ps1

param(
    [string]$ServerIP = "157.180.65.67",
    [string]$Username = "root",
    [string]$SshKey = "C:\Users\xaxax\5312",
    [int]$Port = 22,
    [string]$ProjectDir = "/opt/mintstudio"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$BackendLocal = Join-Path $Root "backend"
$FrontendLocal = Join-Path $Root "frontend"
$BackendRemote = "$ProjectDir/FeedbackATM/backend"
$FrontendRemote = "$ProjectDir/FeedbackATM/frontend"

function ScpTo {
    param([string]$LocalPath, [string]$RemoteTarget)
    if (-not (Test-Path $LocalPath)) { return }
    $scpArgs = @("-P", $Port, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30")
    if ($SshKey -and (Test-Path $SshKey)) { $scpArgs += @("-i", $SshKey) }
    & scp @scpArgs -r $LocalPath "${Username}@${ServerIP}:${RemoteTarget}/"
    if ($LASTEXITCODE -ne 0) { throw "SCP failed: $LocalPath" }
}

function SshRun {
    param([string]$Cmd)
    $sshArgs = @("-p", $Port, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30")
    if ($SshKey -and (Test-Path $SshKey)) { $sshArgs += @("-i", $SshKey) }
    & ssh @sshArgs "${Username}@${ServerIP}" $Cmd
    if ($LASTEXITCODE -ne 0) { throw "SSH failed" }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "FEEDBACKATM — DEPLOY (backend + frontend)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Server: $Username@$ServerIP | Remote: $ProjectDir" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $BackendLocal)) { Write-Host "ERROR: backend not found" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $FrontendLocal)) { Write-Host "ERROR: frontend not found" -ForegroundColor Red; exit 1 }

# 0. Directories on server
Write-Host "0. Creating remote directories..." -ForegroundColor Yellow
SshRun "mkdir -p $BackendRemote $FrontendRemote"
Write-Host "   OK" -ForegroundColor Green
Write-Host ""

# 1. Backend (without node_modules, dist)
Write-Host "1. Copying backend..." -ForegroundColor Yellow
foreach ($item in @("src", "prisma", "package.json", "package-lock.json", "tsconfig.json", "Dockerfile", "Dockerfile.prod", "env.example")) {
    $p = Join-Path $BackendLocal $item
    if (Test-Path $p) { ScpTo $p $BackendRemote }
}
Write-Host "   OK" -ForegroundColor Green
Write-Host ""

# 2. Frontend (without node_modules)
Write-Host "2. Copying frontend..." -ForegroundColor Yellow
foreach ($item in @("src", "index.html", "vite.config.ts", "tailwind.config.js", "postcss.config.js", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.node.json", "nginx.conf", "Dockerfile", "env.example")) {
    $p = Join-Path $FrontendLocal $item
    if (Test-Path $p) { ScpTo $p $FrontendRemote }
}
Write-Host "   OK" -ForegroundColor Green
Write-Host ""

# 3. Rebuild and start both containers
Write-Host "3. Rebuilding and starting feedbackatm-backend, feedbackatm-frontend..." -ForegroundColor Yellow
SshRun "cd $ProjectDir && docker compose -f docker-compose.all.yml up -d --build feedbackatm-backend feedbackatm-frontend"
Write-Host "   OK" -ForegroundColor Green
Write-Host ""

Write-Host "Container status:" -ForegroundColor Gray
SshRun "cd $ProjectDir && docker compose -f docker-compose.all.yml ps feedbackatm-backend feedbackatm-frontend"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DONE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
