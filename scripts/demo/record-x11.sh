#!/usr/bin/env bash
# Usage: npm run demo:record:x11 -- <outDir>
# Records the teaser through a virtual X display at DEMO_FPS (default 60) instead of
# Playwright's 25fps screencast. Needs Xvfb and ffmpeg with x11grab on PATH, and the
# dev server running with VITE_MOCK_PROVIDER=true.
set -euo pipefail
OUT="${1:?outDir required}"
W="${DEMO_WIDTH:-1920}"; H="${DEMO_HEIGHT:-1080}"
DISPLAY_NUM="${DEMO_DISPLAY:-:99}"
mkdir -p "$OUT"
Xvfb "$DISPLAY_NUM" -screen 0 "${W}x${H}x24" -nolisten tcp >/dev/null 2>&1 &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [ -S "/tmp/.X11-unix/X${DISPLAY_NUM#:}" ] && break; sleep 0.1; done
sleep 0.5
DISPLAY="$DISPLAY_NUM" DEMO_CAPTURE=screen DEMO_WIDTH="$W" DEMO_HEIGHT="$H" node "$(dirname "$0")/record-teaser.mjs" "$OUT"
