#!/usr/bin/env bash
# Usage: npm run demo:encode -- <recDir> <outDir> <music file>
set -euo pipefail
REC="$1"; OUT="$2"; MUSIC="$3"
# Playwright captures are page@*.webm; x11 captures are capture.mp4. (ls fails under pipefail when a glob misses.)
VIDEO=$( { ls "$REC"/capture.mp4 "$REC"/*.webm 2>/dev/null || true; } | head -1)
[ -n "$VIDEO" ] || { echo "no capture found in $REC" >&2; exit 1; }
FPS=$(python3 -c "import json; print(min(60, json.load(open('$REC/marks.json')).get('fps', 25)))")
if [ "$FPS" -lt 30 ]; then FPS=30; fi
START=$(python3 -c "import json,sys; m=json.load(open('$REC/marks.json'))['marks']; print(max(0, next(x['t'] for x in m if x['label']=='welcome visible') + 0.15))")
END=$(python3 -c "import json,sys; m=json.load(open('$REC/marks.json'))['marks']; print(next(x['t'] for x in m if x['label']=='end') + 0.2)")
DUR=$(python3 -c "print(round($END - $START, 3))")
echo "trim start=$START end=$END dur=$DUR"
FADE_OUT_START=$(python3 -c "print(round($DUR - 0.8, 3))")
AFADE_OUT_START=$(python3 -c "print(round($DUR - 3.0, 3))")

# 1. Silent master mp4 (h264, 30fps for Playwright captures / source fps for x11, at the recorded size)
ffmpeg -v error -y -ss "$START" -t "$DUR" -i "$VIDEO" \
  -vf "fps=$FPS,pad=ceil(iw/2)*2:ceil(ih/2)*2,fade=t=in:st=0:d=0.5,fade=t=out:st=$FADE_OUT_START:d=0.8,format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 -movflags +faststart -an "$OUT/vorbis-player-teaser-silent.mp4"

# 2. Scored mp4: same video + CC0 music bed, normalized, faded
ffmpeg -v error -y -i "$OUT/vorbis-player-teaser-silent.mp4" -ss 0 -t "$DUR" -i "$MUSIC" \
  -filter_complex "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11,afade=t=in:st=0:d=1.2,afade=t=out:st=$AFADE_OUT_START:d=3.0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT/vorbis-player-teaser.mp4"

# 3. README GIF: highlight cut (Wave visualizer -> Grid -> zen mode), 800px wide, 12fps
HL_START=$(python3 -c "import json; m=json.load(open('$REC/marks.json'))['marks']; print(round(next(x['t'] for x in m if x['label']=='style Wave') - 2.5 - $START, 3))")
HL_END=$(python3 -c "import json; m=json.load(open('$REC/marks.json'))['marks']; print(round(next(x['t'] for x in m if x['label']=='zen off') - 0.3 - $START, 3))")
HL_DUR=$(python3 -c "print(round($HL_END - $HL_START, 3))")
echo "highlight gif start=$HL_START dur=$HL_DUR"
ffmpeg -v error -y -ss "$HL_START" -t "$HL_DUR" -i "$OUT/vorbis-player-teaser-silent.mp4" \
  -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$OUT/vorbis-player-teaser-highlight.gif"

# 4. Full-length GIF, smaller (640px, 10fps) for anyone who wants the whole teaser inline
ffmpeg -v error -y -i "$OUT/vorbis-player-teaser-silent.mp4" \
  -vf "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$OUT/vorbis-player-teaser-full.gif"

ls -la "$OUT"
for f in "$OUT"/*.mp4 "$OUT"/*.gif; do printf "%s  " "$(basename "$f")"; ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of csv=p=0 "$f" | tr '\n' ' '; echo; done
