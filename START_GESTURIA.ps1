# ============================================================
#  START GESTURIA — one click brings the whole country up.
#  Run:  powershell -File C:\Users\lenovo\Documents\gesturia\START_GESTURIA.ps1
#  Safe to re-run any time: kills stale instances first.
# ============================================================
$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "  GESTURIA - a country of gestures" -ForegroundColor Yellow
Write-Host "  ================================" -ForegroundColor DarkYellow

# 0) stop stale instances
Get-CimInstance Win32_Process -Filter "Name like 'python%'" |
  Where-Object { $_.CommandLine -match 'uvicorn.*8020' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$web = Get-NetTCPConnection -State Listen -LocalPort 3003 | Select-Object -First 1
if ($web) { taskkill /PID $web.OwningProcess /T /F | Out-Null }
Start-Sleep 2

# 0.5) database — start the local PostgreSQL (native binaries) if it isn't already running.
# Persistence layer for accounts, learning progress, evaluations, certificates, broadcasts.
$pgBin  = "C:\gesturia-train\pgsql\bin"
$pgLib  = "C:\gesturia-train\pgsql\lib"
$pgData = "C:\gesturia-train\pgdata"
if (Test-Path "$pgBin\pg_ctl.exe") {
  # forked postgres backends load DLLs from lib — without it on PATH they die with 0xC0000142
  $env:PATH = "$pgBin;$pgLib;$env:PATH"
  & "$pgBin\pg_ctl.exe" -D $pgData status *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  starting PostgreSQL :5432..." -ForegroundColor Gray
    & "$pgBin\pg_ctl.exe" -D $pgData -l "$pgData\server.log" -o "-p 5432" start *> $null
    for ($i = 0; $i -lt 20; $i++) { Start-Sleep 1; & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5432 *> $null; if ($LASTEXITCODE -eq 0) { break } }
  }
}

# 1) the engine (API :8020) — bound to the network so phones can join
$env:PYTHONUNBUFFERED = "1"
$env:LMS_DATABASE_URL = "postgresql+psycopg2://gesturia:gesturia_dev_secret@127.0.0.1:5432/gesturia"
$env:GESTURIA_MESH_DEV = "cuda"        # GPU is free -> fast mesh; falls back to CPU automatically on OOM
$env:GESTURIA_NLP_DEV = "cuda"         # MiniLM + Qwen (synonyms / context-aware typo) on GPU
$env:GESTURIA_WHISPER_DEVICE = "cuda"  # multilingual speech-to-sign on GPU (auto CPU fallback)
$env:PYTORCH_CUDA_ALLOC_CONF = "expandable_segments:True"   # avoid transient OOM -> CPU fallback
# Runs 100% from C: — the dictionary + SMPL-X model are mirrored to C:\gesturia-train\mirror, so F: can
# be unplugged. Load French/Whisper models from the local cache (no network needed during a presentation):
$env:HF_HUB_OFFLINE = "1"
$env:HF_HUB_ENABLE_HF_TRANSFER = "0"
New-Item -ItemType Directory -Force -Path "C:\gesturia-train\proj\reports" | Out-Null
Start-Process -WindowStyle Hidden -WorkingDirectory "C:\gesturia-train\proj" `
  -FilePath "C:\gesturia-train\venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","src.api.main:app","--host","0.0.0.0","--port","8020" `
  -RedirectStandardOutput "C:\gesturia-train\proj\reports\api8020.log" `
  -RedirectStandardError  "C:\gesturia-train\proj\reports\api8020.err.log"

# 2) the web app (:3003)
Start-Process -WindowStyle Hidden -WorkingDirectory "C:\Users\lenovo\Documents\gesturia\gesturia-app\apps\web-gesturia" `
  -FilePath "cmd.exe" -ArgumentList "/c","npx next dev -p 3003" `
  -RedirectStandardOutput "C:\Users\lenovo\Documents\gesturia\gesturia-app\web_dev_3003.log" `
  -RedirectStandardError  "C:\Users\lenovo\Documents\gesturia\gesturia-app\web_dev_3003.err.log"

# 3) keep the machine awake for the broadcast
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null

# 4) wait + verify
Write-Host "  starting engine + web..." -ForegroundColor Gray
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
  # pre-compile the pages so the FIRST live visit is instant (next dev compiles per-page on first hit)
  Write-Host "  warming pages..." -ForegroundColor Gray
  foreach ($pg in @("/", "/studio", "/solo", "/evaluate", "/aula", "/learn", "/verify", "/gestx")) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 40 "http://127.0.0.1:3003$pg" | Out-Null } catch {}
  }
  Write-Host ""
  Write-Host "  GESTURIA IS LIVE" -ForegroundColor Green
  Write-Host "  ----------------------------------------"
  Write-Host "  This PC:     http://127.0.0.1:3003"
  Write-Host "  Phones/LAN:  http://${ip}:3003"
  Write-Host "  Studio:      http://127.0.0.1:3003/studio   (Gestlingua - speak / stream)"
  Write-Host "  Gestsolo:    http://127.0.0.1:3003/solo     (learn + evaluator)"
  Write-Host "  Sign judge:  http://127.0.0.1:3003/evaluate (webcam sign-precision grading)"
  Write-Host "  More:        Classroom /aula   Certificates /verify   Extension /gestx"
  Write-Host ""
  Write-Host "  HEALING STREAMS: open /studio -> Stream tab -> paste the service link -> Interpret"
  Write-Host "  Share button copies the public viewer link; open that link in OBS for TV."
  Write-Host "  ----------------------------------------"
  Start-Process "http://127.0.0.1:3003/studio"   # open the studio in the default browser
} else {
  Write-Host "  Something did not come up - check:" -ForegroundColor Red
  Write-Host "    C:\gesturia-train\proj\reports\api8020.err.log"
  Write-Host "    C:\Users\lenovo\Documents\gesturia\gesturia-app\web_dev_3003.err.log"
  Write-Host "  Note: the dictionary needs the F: drive OR the C: mirror (automatic fallback)."
}
