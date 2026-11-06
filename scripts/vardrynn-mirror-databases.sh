#!/usr/bin/env bash
# Copies the mod metadata and project mapping databases into a Vardrynn bucket, where the
# service's /v1/databases route serves them to the launcher.
#
# Usage: scripts/vardrynn-mirror-databases.sh [--verify-only] <dir>
#   <dir>/mod-metadata/db.sqlite and db.sqlite.sha1
#   <dir>/project-mapping/<locale>.sqlite.gz and <locale>.sqlite.sha256 (sha256 of the unzipped file)
# Environment (not needed with --verify-only): S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID,
#   AWS_SECRET_ACCESS_KEY, optional AWS_DEFAULT_REGION (us-east-1).
#
# Every file is checked against its checksum before anything is uploaded, the same check the
# launcher makes. A database whose checksum matches the stored one is skipped. Data goes up before
# its checksum file, so the stored checksum never names data that is not there yet.
set -euo pipefail

verify_only=
if [ "${1:-}" = --verify-only ]; then verify_only=1; shift; fi
dir=${1:?usage: $0 [--verify-only] <dir>}

fail() { echo "error: $*" >&2; exit 1; }
trim() { tr -d ' \t\r\n' < "$1"; }

sha1_of() { if command -v sha1sum >/dev/null; then sha1sum | cut -d' ' -f1; else shasum -a 1 | cut -d' ' -f1; fi; }
sha256_of() { if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }

# Each entry: "<database> <data file> <checksum file>"
entries=()

mm="$dir/mod-metadata"
[ -f "$mm/db.sqlite" ] && [ -f "$mm/db.sqlite.sha1" ] || fail "missing $mm/db.sqlite or db.sqlite.sha1"
expected=$(trim "$mm/db.sqlite.sha1")
[[ $expected =~ ^[0-9a-f]{40}$ ]] || fail "db.sqlite.sha1 is not a sha1"
actual=$(sha1_of < "$mm/db.sqlite")
[ "$actual" = "$expected" ] || fail "db.sqlite does not match db.sqlite.sha1"
entries+=("mod-metadata db.sqlite db.sqlite.sha1")

pm="$dir/project-mapping"
shopt -s nullglob
gz=("$pm"/*.sqlite.gz)
[ ${#gz[@]} -gt 0 ] || fail "no project mapping databases in $pm"
[ -f "$pm/en.sqlite.gz" ] || fail "the launcher falls back to en.sqlite.gz, which is missing"
for file in "${gz[@]}"; do
  name=$(basename "$file")
  locale=${name%.sqlite.gz}
  # Same names the service route accepts.
  [[ $locale =~ ^[a-z]{2,3}(-[a-z0-9]{2,8})?$ ]] || fail "unexpected locale file $name"
  [ -f "$pm/$locale.sqlite.sha256" ] || fail "missing $locale.sqlite.sha256"
  expected=$(trim "$pm/$locale.sqlite.sha256")
  [[ $expected =~ ^[0-9a-f]{64}$ ]] || fail "$locale.sqlite.sha256 is not a sha256"
  actual=$(gzip -dc "$file" | sha256_of) || fail "$name is not a valid gzip file"
  [ "$actual" = "$expected" ] || fail "$name does not match $locale.sqlite.sha256"
  entries+=("project-mapping $name $locale.sqlite.sha256")
done

echo "verified ${#entries[@]} databases"
[ -n "$verify_only" ] && exit 0

: "${S3_ENDPOINT:?}" "${S3_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
s3() { aws --endpoint-url "$S3_ENDPOINT" --cli-connect-timeout 30 --cli-read-timeout 300 s3 "$@"; }

for entry in "${entries[@]}"; do
  read -r database data sum <<< "$entry"
  key="s3://$S3_BUCKET/databases/$database"
  local_sum=$(trim "$dir/$database/$sum")
  stored_sum=$(s3 cp "$key/$sum" - 2>/dev/null | tr -d ' \t\r\n' || true)
  if [ "$stored_sum" = "$local_sum" ]; then
    echo "unchanged: $database/$data"
    continue
  fi
  s3 cp "$dir/$database/$data" "$key/$data" --content-type application/octet-stream --no-progress
  s3 cp "$dir/$database/$sum" "$key/$sum" --content-type text/plain --no-progress
  echo "uploaded: $database/$data"
done
