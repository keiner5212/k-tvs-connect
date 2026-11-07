#!/usr/bin/env bash
# Build the debug apk inside Docker, no EAS. Usage: build-apk.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mkdir -p build
rm -f build/app-debug.apk

echo "building the image"
docker build -f docker/Dockerfile -t k-tvs-connect:apk .

echo "seeding the gradle cache volume"
if ! docker run --rm -v k-tvs-connect-gradle:/cache alpine sh -c 'ls /cache/caches >/dev/null 2>&1' >/dev/null 2>&1; then
  docker volume create k-tvs-connect-gradle >/dev/null
  docker run --rm \
    -v "$HOME/.gradle:/src:ro" \
    -v k-tvs-connect-gradle:/cache \
    alpine sh -c 'cp -a /src/. /cache/'
fi

echo "building the apk inside the container"
docker run --rm \
  -v "$root/build:/out" \
  -v k-tvs-connect-gradle:/opt/gradle-home \
  k-tvs-connect:apk

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
