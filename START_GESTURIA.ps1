# ============================================================
#  START GESTURIA — one click brings the whole country up.
#  Run:  powershell -File C:\Users\lenovo\Documents\gesturia\START_GESTURIA.ps1
#  Safe to re-run any time. Never blocks: all services start via the
#  idempotent keeper (the old inline PG/npx logic could hang forever).
# ============================================================
$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "  GESTURIA - a country of gestures" -ForegroundColor Yellow
Write-Host "  ================================" -ForegroundColor DarkYellow

# stop stale web/engine so the keeper starts them fresh
Get-NetTCPConnection -State Listen -LocalPort 8020 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -State Listen -LocalPort 3003 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep 2

# the keeper starts Postgres + Ollama + engine + web, each non-blocking, each proven
& powershell -NoProfile -ExecutionPolicy Bypass -File "C:\gesturia-train\gesturia_keeper.ps1"

Write-Host "  starting engine + web (models load ~30-60s)..." -ForegroundColor Gray
$ok = $false
foreach ($i in 1..40) {
  Start-Sleep 4
  try {
    # 127.0.0.1 not localhost: Windows resolves localhost to IPv6 first and wastes ~2s per call
    $a = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://127.0.0.1:8020/v1/smplx/vocab").StatusCode
    $w = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://127.0.0.1:3003").StatusCode
    if ($a -eq 200 -and $w -eq 200) { $ok = $true; break }
  } catch {}
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^192\.168\.|^10\.' } | Select-Object -First 1).IPAddress

if ($ok) {
  Write-Host "  warming pages..." -ForegroundColor Gray
  foreach ($pg in @("/", "/studio", "/solo", "/evaluate", "/aula", "/learn", "/verify", "/gestx", "/vocab", "/vocab/live")) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 40 "http://127.0.0.1:3003$pg" | Out-Null } catch {}
  }
  Write-Host ""
  Write-Host "  GESTURIA IS LIVE" -ForegroundColor Green
  Write-Host "  ----------------------------------------"
  Write-Host "  This PC:     http://127.0.0.1:3003"
  Write-Host "  Phones/LAN:  http://${ip}:3003"
  Write-Host "  Studio:      http://127.0.0.1:3003/studio"
  Write-Host "  Recorder:    http://127.0.0.1:3003/vocab/live"
  Write-Host "  ----------------------------------------"
  Start-Process "http://127.0.0.1:3003/studio"
} else {
  Write-Host "  Something did not come up - check:" -ForegroundColor Red
  Write-Host "    C:\gesturia-train\proj\reports\api8020.err.log"
  Write-Host "    C:\Users\lenovo\Documents\gesturia\gesturia-app\web_keeper.err.log"
  Write-Host "  (the keeper retries every 5 minutes automatically)"
}
