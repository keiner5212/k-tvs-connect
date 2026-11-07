#!/usr/bin/env bash
# Drive the app on the connected phone and capture a screen.
# Usage: tools/tap.sh <text> <outfile> [sleep]
set -euo pipefail

text="${1:?usage: tap.sh <text> <outfile> [sleep]}"
out="${2:?usage: tap.sh <text> <outfile> [sleep]}"
pause="${3:-4}"

adb shell uiautomator dump /sdcard/_tap.xml >/dev/null 2>&1
coords="$(adb shell cat /sdcard/_tap.xml 2>/dev/null | tr '<' '\n<' | grep -F "text=\"$text\"" | head -1 \
  | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' \
  | grep -oE '[0-9]+' \
  | awk 'NR==1{x1=$1} NR==2{y1=$1} NR==3{x2=$1} NR==4{y2=$1} END{printf "%d %d", (x1+x2)/2, (y1+y2)/2}')"

if [ -z "$coords" ]; then
  echo "not found: $text" >&2
  exit 1
fi

adb shell input tap $coords >/dev/null 2>&1
sleep "$pause"
adb exec-out screencap -p > "$out"
echo "tapped $text at $coords -> $out"
