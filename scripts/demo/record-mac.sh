#!/usr/bin/env bash
# Usage: npm run demo:record:mac -- <outDir>
# Records the teaser on macOS through ffmpeg's avfoundation screen capture at DEMO_FPS
# (default 60). Headful Chromium goes fullscreen on your main display, so the viewport is
# the display's logical size (DEMO_WIDTH/DEMO_HEIGHT are ignored here).
#
# Requirements:
#   - ffmpeg on PATH (brew install ffmpeg)
#   - Screen Recording permission for the terminal app you run this from
#     (System Settings > Privacy & Security > Screen Recording). Without it the capture is black.
#   - the dev server running with VITE_MOCK_PROVIDER=true
#   - leave the machine alone while it records: the browser is on your real screen
#
# Env knobs: DEMO_FPS (60), DEMO_SCREEN_DEVICE (avfoundation screen index, auto-detected),
# DEMO_NATIVE_SCALE=1 (keep Retina device pixels instead of scaling to CSS pixels),
# DEMO_ENCODER=libx264 (software encode instead of VideoToolbox).
set -euo pipefail
OUT="${1:?outDir required}"
if [ "$(uname -s)" != "Darwin" ]; then echo "record-mac.sh is for macOS; use record-x11.sh on Linux" >&2; exit 1; fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found; brew install ffmpeg" >&2; exit 1; }
# -list_devices exits non-zero after printing ("Error opening input" is normal there), and pipefail
# would turn that into a failure despite the grep match, so swallow ffmpeg's status.
{ ffmpeg -hide_banner -f avfoundation -list_devices true -i "" 2>&1 || true; } | grep -q "Capture screen" \
  || { echo "ffmpeg has no avfoundation screen device; is this a Homebrew ffmpeg build?" >&2; exit 1; }
mkdir -p "$OUT"
DEMO_CAPTURE=screen node "$(dirname "$0")/record-teaser.mjs" "$OUT"
