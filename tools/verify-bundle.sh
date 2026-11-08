#!/usr/bin/env bash
# Fail when the built bundle still contains a TVS surface. Usage: verify-bundle.sh <apk|bundle>
set -euo pipefail

target="${1:?usage: verify-bundle.sh <apk|bundle>}"

patterns='tvsmotor|tvsm\.connect|tvsmotor\.net|p360\.tvsmotor|cdpcom-dev|tvsmapisrvr|tvsiqubeapi|bluconnect|aptener|servicebus\.windows\.net|firebaseio|firebaseapp|RSA_TOKEN|indicosmic'

# The google key of this app is allowed, every other google key is a TVS
# surface. The hash is committed, the key is not.
allowed_key_sha256='72b614d7faaadbe6b7bc804387e93b631f73775979f6140c8a5d74bc47600b88'

if [ ! -e "$target" ]; then
  echo "target not found: $target" >&2
  exit 1
fi

tmp="${TMPDIR:-$PWD/.tmp}/$(basename "$0").XXXXXX"
mkdir -p "$tmp"
trap 'rm -rf "$tmp"' EXIT

if [ -d "$target" ]; then
  scan="$target"
elif unzip -l "$target" >/dev/null 2>&1; then
  unzip -o -q "$target" -d "$tmp"
  scan="$tmp"
else
  scan="$target"
fi

grep -rIlE "$patterns" "$scan" || true

if grep -rIqE "$patterns" "$scan"; then
  echo "FAIL: a TVS surface is still present in $target" >&2
  exit 1
fi

for key in $(grep -rhoE 'AIza[0-9A-Za-z_-]{35}' "$scan" | sort -u); do
  hash=$(printf '%s' "$key" | sha256sum | cut -d' ' -f1)
  if [ "$hash" != "$allowed_key_sha256" ]; then
    echo "FAIL: an unexpected google api key is present in $target" >&2
    exit 1
  fi
done

echo "OK: no TVS surface in $target"
