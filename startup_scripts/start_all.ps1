Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$serverDir = Join-Path $rootDir 'src\server'
$inferenceDir = Join-Path $rootDir 'src\inference'
$modelsDir = Join-Path $rootDir 'models'

function Get-ModelPath {
  param(
    [string]$RootDir,
    [string]$ModelsDir
  )

  if ($env:ARANYA_MODEL_PATH) {
    $configuredPath = $env:ARANYA_MODEL_PATH
    if (Test-Path $configuredPath -PathType Leaf) {
      return (Resolve-Path $configuredPath).Path
    }

    if (Test-Path $configuredPath -PathType Container) {
      foreach ($relative in @('weights\best.pt', 'best.pt', 'model.pt')) {
        $candidate = Join-Path $configuredPath $relative
        if (Test-Path $candidate -PathType Leaf) {
          return (Resolve-Path $candidate).Path
        }
      }
    }

    Write-Warning "ARANYA_MODEL_PATH is set but no usable .pt file was found under it: $configuredPath"
  }

  foreach ($candidate in @(
    (Join-Path $ModelsDir 'best.pt'),
    (Join-Path $RootDir 'best.pt'),
    (Join-Path $RootDir 'best\weights\best.pt'),
    (Join-Path $RootDir 'best\best.pt')
  )) {
    if (Test-Path $candidate -PathType Leaf) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

Set-Location $rootDir

Write-Host ''
Write-Host '============================================'
Write-Host '  ARANYA WILDLIFE DETECTION SYSTEM'
Write-Host '  Structured Project Launcher'
Write-Host '============================================'
Write-Host ''

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python is not installed or not on PATH.'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed or not on PATH.'
}

if (-not (Get-ModelPath -RootDir $rootDir -ModelsDir $modelsDir)) {
  Write-Warning 'No usable local model weights were found. Set ARANYA_MODEL_PATH or place best.pt in models/.'
}

Write-Host '[OK] Python:' (python --version)
Write-Host '[OK] Node.js:' (node --version)
Write-Host "[OK] Project Root: $rootDir"
Write-Host ''

$pythonCmd = "cd `"$inferenceDir`"; python inference_api.py"
$nodeMainCmd = "cd `"$serverDir`"; node server.js"
$nodeGalleryCmd = "cd `"$serverDir`"; node mongo_server.js"

Write-Host '[*] Starting Python Inference API...'
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $pythonCmd) -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host '[*] Starting Gallery Server...'
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $nodeGalleryCmd) -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host '[*] Starting Main Server...'
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $nodeMainCmd) -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host ''
Write-Host '✓ All services started in separate PowerShell windows:'
Write-Host '  - Python Inference: http://localhost:5000'
Write-Host '  - Main Server:      http://localhost:3000'
Write-Host '  - Dashboard:        http://localhost:3000'
Write-Host '  - Gallery:          http://localhost:3000/gallery'
Write-Host '  - Gallery Backend:  http://localhost:3001/gallery'
Write-Host ''
Write-Host 'Close any service window to stop that service.'
Write-Host ''
