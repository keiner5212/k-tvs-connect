#!/usr/bin/env bash
# Fail when the built bundle still contains a TVS surface. Usage: verify-bundle.sh <apk|bundle>
set -euo pipefail

target="${1:?usage: verify-bundle.sh <apk|bundle>}"

patterns='tvsmotor|tvsm\.connect|tvsmotor\.net|p360\.tvsmotor|cdpcom-dev|tvsmapisrvr|tvsiqubeapi|bluconnect|aptener|servicebus\.windows\.net|firebaseio|firebaseapp|RSA_TOKEN|indicosmic'

# The google keys of this app are allowed, every other google key is a TVS
# surface. The hashes are committed, the keys are not.
allowed_key_sha256='72b614d7faaadbe6b7bc804387e93b631f73775979f6140c8a5d74bc47600b88 dc21bc4bf7bca683cdbc14375ad92ada270596e5884b975e90e8f8d178791850'

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

for key in $(grep -rhoaE 'AIza[0-9A-Za-z_-]{35}' "$scan" | sort -u); do
  hash=$(printf '%s' "$key" | sha256sum | cut -d' ' -f1)
  case " $allowed_key_sha256 " in
    *" $hash "*) ;;
    *)
      echo "FAIL: an unexpected google api key is present in $target" >&2
      exit 1
      ;;
  esac
done

if grep -rIqE 'session=[A-Za-z0-9_-]{30,}' "$scan"; then
  echo "FAIL: a google tiles session token is baked into $target" >&2
  exit 1
fi

echo "OK: no TVS surface in $target"
