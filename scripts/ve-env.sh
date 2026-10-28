# Source this before local ve test/QC runs: `. scripts/ve-env.sh`
# Pins ffmpeg n8.1.2 (same build and SHA-256 as CI), puts tesseract on PATH,
# and clears the user-level Drive/archive variables so tests never write to the real Drive.
TOOLCHAIN="${VE_TOOLCHAIN:-/c/Users/krish/dev/mindmake/toolchain}"
export PATH="$TOOLCHAIN/ffmpeg-n8.1.2-53-g1005b294ff-win64-gpl-8.1/bin:/c/Program Files/Tesseract-OCR:$PATH"
unset MINDMAKE_DRIVE_ROOT MINDMAKE_ARCHIVE_ROOT MINDMAKE_MEDIA_INBOX MINDMAKE_RUNTIME_ROOT
