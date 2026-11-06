#!/usr/bin/env bash
# Komplett-Build: Stimmen laden, Sounddesign, Bild, finales MP4 (13 s, 1080p60, H.264, Stereo 48 kHz).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p build
python3 -c "import piper, scipy" 2>/dev/null || pip install piper-tts scipy
./fetch_voices.sh
python3 audio.py build/audio.wav
python3 video.py build/video.mp4
ffmpeg -y -loglevel error -i build/video.mp4 -i build/audio.wav -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 18 -maxrate 30M -bufsize 60M -pix_fmt yuv420p -r 60 -c:a aac -b:a 320k -ar 48000 -ac 2 -t 13 -movflags +faststart \
  -metadata title="GRANDE - Multi-Chat Cinematic" GRANDE_MULTICHAT_CINEMATIC.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact GRANDE_MULTICHAT_CINEMATIC.mp4
