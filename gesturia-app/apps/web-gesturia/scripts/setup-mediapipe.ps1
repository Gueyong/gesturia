# Fetch the MediaPipe vision runtime + models for the Gestsolo evaluator (webcam sign grading).
# These are bundled locally so the evaluator works fully OFFLINE. Run once after cloning:
#   powershell -File apps/web-gesturia/scripts/setup-mediapipe.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # .../apps/web-gesturia
$mp = Join-Path $root "public\mediapipe"
$wasmSrc = Join-Path $root "..\..\node_modules\@mediapipe\tasks-vision\wasm"
New-Item -ItemType Directory -Force -Path (Join-Path $mp "wasm") | Out-Null

if (Test-Path $wasmSrc) {
  Copy-Item (Join-Path $wasmSrc "*") (Join-Path $mp "wasm") -Force
  Write-Host "copied wasm runtime -> public/mediapipe/wasm"
} else {
  Write-Host "run 'npm install' first (needs @mediapipe/tasks-vision)" -ForegroundColor Yellow
}

$models = @{
  "hand_landmarker.task"       = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  "pose_landmarker_lite.task"  = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
}
foreach ($name in $models.Keys) {
  $dest = Join-Path $mp $name
  if (Test-Path $dest) { Write-Host "$name already present"; continue }
  Write-Host "downloading $name ..."
  Invoke-WebRequest -UseBasicParsing -Uri $models[$name] -OutFile $dest
}
Write-Host "MediaPipe ready in public/mediapipe" -ForegroundColor Green
