# Backs up the whole database (products, orders, banners AND all photos/videos) into backend\backups\<date-time>\
# Run from the backend folder:   powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
# Needs MongoDB Database Tools (mongodump): https://www.mongodb.com/try/download/database-tools

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Read MONGODB_URI from .env
$uri = (Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^\s*MONGODB_URI\s*=' } | Select-Object -First 1) -replace '^\s*MONGODB_URI\s*=\s*', ''
if (-not $uri) { throw 'MONGODB_URI not found in .env' }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dest = Join-Path $root "backups\$stamp"
New-Item -ItemType Directory -Force $dest | Out-Null

Write-Host "Dumping database (this includes photos and videos)..."
& mongodump --uri="$uri" --archive="$dest\db.archive.gz" --gzip
if ($LASTEXITCODE -ne 0) { throw 'mongodump failed' }

Write-Host "Backup saved to $dest"
Write-Host "Copy this folder to Google Drive / a USB drive."
