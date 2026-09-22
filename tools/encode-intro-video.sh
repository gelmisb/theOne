#!/usr/bin/env bash
# Re-encodes a raw Kling clip into the file Intro.astro looks for.
#
# Usage:
#   tools/encode-intro-video.sh <raw-clip>
#
# Output lands in src/assets/videos/intro-bg.mp4 — muted, scaled to 1280px
# wide (plenty sharp for a background video; keeps file size sane), and
# all-intra (-g 1, keyframe every frame) so ScrollTrigger can seek
# currentTime during scroll-scrubbing without stutter/blockiness.
#
# mp4/H.264 only, deliberately: all-intra encoding defeats VP9's
# inter-frame compression, so a webm alongside it would just be a bigger
# file for zero reach benefit (H.264 already covers effectively every
# browser this site targets).
#
# Requires ffmpeg on PATH.

set -euo pipefail

RAW="${1:-}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/assets/videos"
mkdir -p "$OUT_DIR"

if [[ -z "$RAW" ]]; then
  echo "Usage: $0 <raw-clip>" >&2
  exit 1
fi

echo "Encoding -> $OUT_DIR/intro-bg.mp4"
ffmpeg -y -i "$RAW" -vf scale=1280:-2 -c:v libx264 -g 1 -crf 20 -pix_fmt yuv420p -an "$OUT_DIR/intro-bg.mp4"

echo "Done. Intro.astro will pick this up automatically on next dev/build — no code changes needed."
