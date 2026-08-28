$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $repoRoot '.venv'

if (-not (Test-Path -LiteralPath $venvPath)) {
  & python -m venv $venvPath
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create the Python virtual environment.' }
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
& $venvPython -m pip install --require-hashes --only-binary=:all: -r (Join-Path $repoRoot 'requirements.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Pinned Python dependency installation failed.' }

& $venvPython -c "import faster_whisper, mediapipe, scenedetect; print('Pinned Python runtime is ready.')"
if ($LASTEXITCODE -ne 0) { throw 'Python runtime verification failed.' }
