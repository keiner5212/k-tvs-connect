#!/usr/bin/env bash
# Import native libraries into a Ghidra project. Usage: ghidra-native.sh <apk|libdir> [project-name]
set -euo pipefail

target="${1:?usage: ghidra-native.sh <apk|libdir> [project-name]}"
project_name="${2:-Native}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ -f "$target" ]; then
  unzip -o -q "$target" -d "$work"
  target="$work"
fi

mapfile -t libs < <(find "$target" -name '*.so' -print | sort)
if [ "${#libs[@]}" -eq 0 ]; then
  echo "no native libraries found in $target" >&2
  exit 1
fi

mkdir -p "$GHIDRA_PROJECTS"
echo "project: $GHIDRA_PROJECTS/$project_name"
for lib in "${libs[@]}"; do
  name="$(basename "$lib")"
  echo "-> $name"
  "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$GHIDRA_PROJECTS" "$project_name" \
    -import "$lib" -overwrite 2>&1 | grep -E 'REPORT:|ERROR' || true
done

echo
echo "open it with: $GHIDRA_INSTALL_DIR/ghidraRun $GHIDRA_PROJECTS/$project_name"
