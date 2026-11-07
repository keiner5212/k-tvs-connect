#!/usr/bin/env bash
# Build the debug APK inside Docker, no EAS. Usage: build-apk.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mkdir -p build

echo "building the debug apk in docker"
docker build -f docker/Dockerfile -t k-tvs-connect:apk .

container="$(docker create k-tvs-connect:apk)"
docker cp "$container:/app/build/app-debug.apk" "$root/build/app-debug.apk"
docker rm "$container" >/dev/null

echo "apk: $root/build/app-debug.apk"
echo
echo "install it with:"
echo "  adb install -r $root/build/app-debug.apk"
echo
echo "check it with:"
echo "  tools/verify-bundle.sh $root/build/app-debug.apk"
