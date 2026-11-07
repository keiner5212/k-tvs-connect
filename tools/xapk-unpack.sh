#!/usr/bin/env bash
# Split an XAPK into its APK parts. Usage: xapk-unpack.sh <file.xapk> [outdir]
set -euo pipefail

src="${1:?usage: xapk-unpack.sh <file.xapk> [outdir]}"
out="${2:-${src%.xapk}-unpacked}"

mkdir -p "$out"
unzip -o -q "$src" -d "$out"

python3 - "$out" <<'PY'
import json
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
manifest = out / "manifest.json"
if not manifest.exists():
    print("no manifest.json in archive")
    sys.exit(1)

data = json.loads(manifest.read_text())
print(f"package: {data.get('package_name', 'unknown')}")
print(f"version: {data.get('version_code', '?')} / {data.get('version_name', '?')}")
for split in data.get("splits", []):
    name = split.get("split_name", "?")
    file = split.get("file", "?")
    abi = ",".join(split.get("abis", [])) or "-"
    size = split.get("size", "?")
    print(f"  split {name:10} file={file:40} abi={abi:20} size={size}")
PY

printf '\napks:\n'
find "$out" -name '*.apk' -printf '  %p (%s bytes)\n'
printf '\nbase apk for jadx/apktool: %s\n' \
  "$(find "$out" -name 'base.apk' -print -quit)"
