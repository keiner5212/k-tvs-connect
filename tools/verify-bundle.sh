#!/usr/bin/env bash
# Fail when the built bundle still contains a TVS surface. Usage: verify-bundle.sh <apk|bundle>
set -euo pipefail

target="${1:?usage: verify-bundle.sh <apk|bundle>}"

patterns='tvsmotor|tvsm\.connect|tvsmotor\.net|p360\.tvsmotor|cdpcom-dev|tvsmapisrvr|tvsiqubeapi|bluconnect|aptener|servicebus\.windows\.net|firebaseio|firebaseapp|AIza|RSA_TOKEN|indicosmic'

if [ ! -e "$target" ]; then
  echo "target not found: $target" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [ -d "$target" ]; then
  grep -rIlE "$patterns" "$target" || true
elif unzip -l "$target" >/dev/null 2>&1; then
  unzip -o -q "$target" -d "$tmp"
  grep -rIlE "$patterns" "$tmp" || true
else
  grep -IlE "$patterns" "$target" || true
fi

if grep -rIqE "$patterns" "$tmp" 2>/dev/null || { [ ! -d "$target" ] && unzip -l "$target" >/dev/null 2>&1 && grep -rIqE "$patterns" "$tmp"; }; then
  echo "FAIL: a TVS surface is still present in $target" >&2
  exit 1
fi

echo "OK: no TVS surface in $target"
