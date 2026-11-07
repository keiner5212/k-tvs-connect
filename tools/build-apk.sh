#!/usr/bin/env bash
# Build the debug apk inside Docker, no EAS. Usage: build-apk.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mkdir -p build
rm -f build/app-debug.apk

echo "building the image"
docker build -f docker/Dockerfile -t k-tvs-connect:apk .

echo "building the apk inside the container"
docker run --rm -v "$root/build:/out" k-tvs-connect:apk

if [ ! -f "$root/build/app-debug.apk" ]; then
  echo "FAIL: no apk was produced" >&2
  exit 1
fi

echo
echo "apk: $root/build/app-debug.apk"
echo "install it with:"
echo "  adb install -r $root/build/app-debug.apk"
echo "check it with:"
echo "  tools/verify-bundle.sh $root/build/app-debug.apk"
