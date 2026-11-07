#!/usr/bin/env bash
# Upload an APK/XAPK to MobSF and pull the JSON and PDF report. Usage: mobsf-up.sh <file.apk|file.xapk> [outdir]
set -euo pipefail

file="${1:?usage: mobsf-up.sh <file.apk|file.xapk> [outdir]}"
out="${2:-$(dirname "$file")/mobsf-report}"
host="${MOBSF_HOST:-http://127.0.0.1:8000}"
container="${MOBSF_CONTAINER:-mobsf}"

logs="$(docker logs "$container" 2>&1 | sed -r 's/\x1B\[[0-9;]*[mK]//g')"
key="$(printf '%s\n' "$logs" | awk '/REST API Key: /{ if (!found) { sub(/^.*REST API Key: /, ""); print; found = 1 } }')"
if [ -z "$key" ]; then
  echo "cannot read MobSF API key from container logs" >&2
  exit 1
fi

mkdir -p "$out"
upload="$(curl -sS -m 120 -F "file=@$file" -H "Authorization: $key" "$host/api/v1/upload")"
echo "$upload"

hash="$(printf '%s' "$upload" | sed -r 's/.*"hash"[[:space:]]*:[[:space:]]*"([a-f0-9]+)".*/\1/')"
if [ -z "$hash" ] || [ "$hash" = "$upload" ]; then
  echo "upload did not return a hash" >&2
  exit 1
fi

echo "hash: $hash"
echo "starting static analysis"
curl -sS -m 600 -X POST -H "Authorization: $key" -d "hash=$hash" "$host/api/v1/scan" > "$out/scan.json" || true
for attempt in $(seq 1 180); do
  report="$(curl -sS -m 60 -X POST -H "Authorization: $key" -d "hash=$hash" "$host/api/v1/report_json")"
  if ! printf '%s' "$report" | grep -q '"error"\|Report not Found'; then
    printf '%s' "$report" > "$out/report.json"
    curl -sS -m 120 -X POST -H "Authorization: $key" -d "hash=$hash" "$host/api/v1/download_pdf" > "$out/report.pdf"
    echo "report: $out/report.json"
    echo "report: $out/report.pdf"
    exit 0
  fi
  echo "attempt $attempt: report not ready"
  sleep 5
done

echo "report not available after 150s, check $host for scan $hash" >&2
exit 1
