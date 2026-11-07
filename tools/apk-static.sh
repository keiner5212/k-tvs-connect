#!/usr/bin/env bash
# Static triage of an APK. Usage: apk-static.sh <file.apk> [outdir]
set -euo pipefail

apk="${1:?usage: apk-static.sh <file.apk> [outdir]}"
out="${2:-${apk%.apk}-static}"
mkdir -p "$out"

echo "== badging =="
aapt2 dump badging "$apk" > "$out/badging.txt" 2>/dev/null || true
head -40 "$out/badging.txt"

echo
echo "== signature =="
apksigner verify --print-certs "$apk" 2>&1 | head -20 || true

echo
echo "== native libraries =="
unzip -l "$apk" | grep -E '\.so$' || echo "  none"

echo
echo "== jadx decompile -> $out/jadx =="
JADX_OPTS="${JADX_OPTS:--Xmx6g}" jadx --log-level ERROR -d "$out/jadx" "$apk" 2>&1 | tail -5

echo
echo "== apktool decode -> $out/apktool =="
apktool d -f "$apk" -o "$out/apktool" 2>&1 | tail -5

echo
echo "done: $out"
