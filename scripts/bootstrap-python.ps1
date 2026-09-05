$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$defaultRuntimeRoot = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\runtime'
$runtimeRoot = if ($env:MINDMAKE_RUNTIME_ROOT) { $env:MINDMAKE_RUNTIME_ROOT } else { $defaultRuntimeRoot }

if (-not [string]::Equals([System.IO.Path]::GetFullPath($runtimeRoot), [System.IO.Path]::GetFullPath($defaultRuntimeRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "The Windows runner runtime must remain at $defaultRuntimeRoot so Codex and the Scheduled Task share one state root."
}
$venvPath = Join-Path $runtimeRoot 'python'

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (-not (Test-Path -LiteralPath $venvPath)) {
  & python -m venv $venvPath
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create the Python virtual environment.' }
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
& $venvPython -m pip install --require-hashes --only-binary=:all: -r (Join-Path $repoRoot 'requirements.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Pinned Python dependency installation failed.' }

& $venvPython -c "import faster_whisper, mediapipe, scenedetect; print('Pinned Python runtime is ready.')"
if ($LASTEXITCODE -ne 0) { throw 'Python runtime verification failed.' }
