#!/bin/bash
# Source: Pexels 32790667 (4K, 59.94 fps, 14.63 s). Output: seamless 30 fps loop, grayscale, no audio.
# Grayscale is baked in on purpose: the page tints it with brand tokens in CSS, so the file carries no color.
set -e
SRC=pexels-32790667-4k.mp4
OUT=out
X=1.5                 # crossfade length, seconds
T=14.6                # trim a hair under the source length
mkdir -p $OUT

encode() { # name width crf preset
  local name=$1 w=$2 crf=$3 preset=$4
  ffmpeg -v error -y -i $SRC -filter_complex "
    [0:v]fps=30,scale=${w}:-2:flags=lanczos,format=gray,eq=contrast=1.7:gamma=1.15:brightness=-0.05,hqdn3d=3:2:6:5,split=3[a][b][c];
    [a]trim=start=${X}:end=$(echo "$T - $X" | bc),setpts=PTS-STARTPTS,fps=30[main];
    [b]trim=start=$(echo "$T - $X" | bc):end=${T},setpts=PTS-STARTPTS,fps=30[tail];
    [c]trim=start=0:end=${X},setpts=PTS-STARTPTS,fps=30[head];
    [tail][head]xfade=transition=fade:duration=${X}:offset=0[blend];
    [main][blend]concat=n=2:v=1:a=0,format=yuv420p[out]" \
    -map "[out]" -c:v libx264 -preset $preset -crf $crf -profile:v high -g 60 -keyint_min 60 -sc_threshold 0 -movflags +faststart -an $OUT/story-water-$name.mp4
}

encode 720  1280 28 slow
encode 1080 1920 28 slow
encode 2160 3840 29 slow

# poster: the same grayscale grade, one mid-clip frame
ffmpeg -v error -y -ss 7 -i $SRC -frames:v 1 -vf "scale=1920:-2:flags=lanczos,format=gray,eq=contrast=1.7:gamma=1.15:brightness=-0.05" -q:v 4 $OUT/story-water-poster.jpg
ls -la $OUT
