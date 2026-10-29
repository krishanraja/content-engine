# Source this before local ve test/QC runs: `. scripts/ve-env.sh`
# Pins ffmpeg n8.1.2 (same build and SHA-256 as CI), puts tesseract on PATH,
# and clears the user-level Drive/archive variables so tests never write to the real Drive.
# The toolchain folder is config/studio.json local_roots.toolchain, else the toolchain folder beside the main checkout
# (one local layout, W2.11, scripts/velib/common.py local_root); VE_TOOLCHAIN overrides it.
_ve_repo="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
_ve_python="$(command -v python3 || command -v python)"
_ve_toolchain="$("$_ve_python" "$_ve_repo/scripts/velib/common.py" local-root toolchain --shell)"
TOOLCHAIN="${VE_TOOLCHAIN:-$_ve_toolchain}"
export PATH="$TOOLCHAIN/ffmpeg-n8.1.2-53-g1005b294ff-win64-gpl-8.1/bin:/c/Program Files/Tesseract-OCR:$PATH"
unset MINDMAKE_DRIVE_ROOT MINDMAKE_ARCHIVE_ROOT MINDMAKE_MEDIA_INBOX MINDMAKE_RUNTIME_ROOT
unset _ve_repo _ve_python _ve_toolchain
