# Пересобрать и перезапустить контейнер FeedbackATM backend на сервере
# 1) Копирует папку backend на сервер через SCP
# 2) На сервере выполняет docker compose build + up для feedbackatm-backend
# Usage: .\deploy-backend.ps1

param(
    [string]$ServerIP = "157.180.65.67",
    [string]$Username = "root",
    [string]$SshKey = "C:\Users\xaxax\5312",
    [int]$Port = 22,
    [string]$ProjectDir = "/opt/mintstudio"
)

$ErrorActionPreference = "Stop"
$BackendLocal = Join-Path $PSScriptRoot "backend"
$BackendRemote = "$ProjectDir/FeedbackATM/backend"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "FEEDBACKATM BACKEND - DEPLOY" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendLocal)) {
    Write-Host "ERROR: Backend folder not found: $BackendLocal" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $SshKey)) {
    Write-Host "WARNING: SSH key not found: $SshKey" -ForegroundColor Yellow
    $SshKey = $null
} else {
    Write-Host "SSH key: $SshKey" -ForegroundColor Green
}

Write-Host "Server: $Username@$ServerIP :$Port" -ForegroundColor Gray
Write-Host "Remote path: $BackendRemote" -ForegroundColor Gray
Write-Host ""

# 0. Ensure remote directory exists
Write-Host "0. Ensuring remote directory exists..." -ForegroundColor Yellow
$sshArgsMkdir = @("-p", $Port, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30")
if ($SshKey) { $sshArgsMkdir += @("-i", $SshKey) }
& ssh @sshArgsMkdir ${Username}@${ServerIP} "mkdir -p $BackendRemote"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   FAIL: Could not create remote directory" -ForegroundColor Red
    exit 1
}
Write-Host "   OK" -ForegroundColor Green
Write-Host ""

# 1. SCP: copy backend to server (without node_modules and dist for speed)
Write-Host "1. Copying backend to server (SCP, excluding node_modules/dist)..." -ForegroundColor Yellow
$scpArgs = @("-P", $Port, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30")
if ($SshKey) { $scpArgs += @("-i", $SshKey) }

# Copy essential paths only (Docker will run npm ci and build on server)
$items = @(
    "src",
    "prisma",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "Dockerfile",
    "Dockerfile.prod",
    ".dockerignore",
    "env.example"
)
foreach ($item in $items) {
    $localPath = Join-Path $BackendLocal $item
    if (Test-Path $localPath) {
        & scp @scpArgs -r $localPath "${Username}@${ServerIP}:${BackendRemote}/"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   FAIL: SCP failed for $item" -ForegroundColor Red
            exit 1
        }
    }
}
Write-Host "   OK: Files copied" -ForegroundColor Green
Write-Host ""

# 2. SSH: rebuild and restart container
Write-Host "2. Rebuilding and restarting feedbackatm-backend on server..." -ForegroundColor Yellow
$sshArgs = @("-p", $Port, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30")
if ($SshKey) { $sshArgs += @("-i", $SshKey) }

$commands = @"
cd $ProjectDir && docker compose -f docker-compose.all.yml up -d --build feedbackatm-backend
echo ''
echo 'Container status:'
docker compose -f docker-compose.all.yml ps feedbackatm-backend
echo ''
echo 'Done.'
"@

$commands | & ssh @sshArgs ${Username}@${ServerIP} "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   FAIL: SSH/docker command failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "BACKEND DEPLOYED" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logs: ssh -i `"$SshKey`" -p $Port $Username@$ServerIP 'cd $ProjectDir && docker compose -f docker-compose.all.yml logs -f feedbackatm-backend'" -ForegroundColor Gray
Write-Host ""
