#!/usr/bin/env bash
# Full pipeline: render picture (headless WebGL), synthesise soundtrack, mux final MP4.
#   ./build.sh            -> renders everything and writes ../GRANDE_OFFICIAL_TRAILER.mp4
#   WORKERS=4 ./build.sh  -> number of parallel render workers (default 4)
#   SKIP_RENDER=1 ./build.sh -> reuse existing build/seg_*.mp4 (re-mux only)
set -euo pipefail
cd "$(dirname "$0")"
WORKERS="${WORKERS:-4}"
OUT="../GRANDE_OFFICIAL_TRAILER.mp4"
mkdir -p build

[ -d node_modules ] || npm install

if [ -z "${SKIP_RENDER:-}" ]; then
  rm -rf build/shots
  node render.js --shots --workers "$WORKERS"
fi

python3 audio.py build/soundtrack.wav

# concat picture segments (each is 4:4:4 near-lossless) and encode the delivery master
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segments.txt -i build/soundtrack.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 17 -maxrate 22M -bufsize 44M -profile:v high -pix_fmt yuv420p -r 60 \
  -x264-params "keyint=120:min-keyint=60:aq-mode=3" \
  -vf "scale=1920:1080:flags=lanczos,setsar=1" \
  -c:a aac -b:a 320k -ar 48000 \
  -t 30 -movflags +faststart \
  -metadata title="GRANDE - Official Trailer" \
  "$OUT"

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact "$OUT"
echo "done -> $OUT"
