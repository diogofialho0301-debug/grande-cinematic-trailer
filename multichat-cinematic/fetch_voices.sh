#!/usr/bin/env bash
# Lädt die verwendeten deutschen Piper-Stimmen (rhasspy/piper-voices auf Hugging Face).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p voices
for f in eva_k/x_low/de_DE-eva_k-x_low kerstin/low/de_DE-kerstin-low ramona/low/de_DE-ramona-low \
         karlsson/low/de_DE-karlsson-low pavoque/low/de_DE-pavoque-low thorsten/high/de_DE-thorsten-high \
         thorsten_emotional/medium/de_DE-thorsten_emotional-medium; do
  for ext in onnx onnx.json; do
    out="voices/$(basename $f).$ext"
    [ -s "$out" ] || curl -sSL -o "$out" "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/$f.$ext"
  done
done
echo "Stimmen bereit."
