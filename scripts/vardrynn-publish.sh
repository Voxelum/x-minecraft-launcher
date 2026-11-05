#!/usr/bin/env bash
# Publishes a signed release directory (packages, release.json, SHA256SUMS) to a Vardrynn S3 bucket.
# Packages go first and latest.json last, so a client never sees a manifest whose files are missing.
#
# Usage: scripts/vardrynn-publish.sh <release-dir>
# Environment: S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (publishing pair),
#              optional AWS_DEFAULT_REGION (us-east-1), ALLOW_REPUBLISH=1 to overwrite an existing version.
set -euo pipefail

dir=${1:?usage: vardrynn-publish.sh <release-dir>}
: "${S3_ENDPOINT:?}" "${S3_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
s3() { aws --endpoint-url "$S3_ENDPOINT" --cli-connect-timeout 30 --cli-read-timeout 300 s3 "$@"; }
s3api() { aws --endpoint-url "$S3_ENDPOINT" --cli-connect-timeout 30 s3api "$@"; }

manifest="$dir/release.json"
version=$(jq -er '.version' "$manifest")
[ "$(jq -r '.apiVersion' "$manifest")" = v1 ] || { echo "release.json is not v1" >&2; exit 1; }
base="${S3_ENDPOINT%/}/$S3_BUCKET/$version/"

# Every asset must live in this bucket under this version, and exist locally with the signed hash.
names=()
while IFS=$'\t' read -r url sha; do
  case "$url" in "$base"*) ;; *) echo "asset $url is not under $base" >&2; exit 1 ;; esac
  name=${url#"$base"}
  case "$name" in */* | .* | '') echo "unsafe asset name: $name" >&2; exit 1 ;; esac
  [ -f "$dir/$name" ] || { echo "missing package $name" >&2; exit 1; }
  actual=$( (command -v sha256sum >/dev/null && sha256sum "$dir/$name" || shasum -a 256 "$dir/$name") | cut -d' ' -f1)
  [ "$actual" = "$sha" ] || { echo "$name does not match its signed sha256" >&2; exit 1; }
  names+=("$name")
done < <(jq -r '.assets[] | [.url, .sha256] | @tsv' "$manifest")
[ ${#names[@]} -gt 0 ] || { echo "release.json has no assets" >&2; exit 1; }

# A published version is immutable: clients may already hold its hashes.
if [ "${ALLOW_REPUBLISH:-}" != 1 ] && [ -n "$(s3 ls "s3://$S3_BUCKET/$version/" || true)" ]; then
  echo "version $version is already published in $S3_BUCKET" >&2; exit 1
fi

for name in "${names[@]}"; do
  # aws s3 cp switches to multipart above 8 MB.
  s3 cp "$dir/$name" "s3://$S3_BUCKET/$version/$name" --only-show-errors
  # A HEAD straight after a multipart upload can briefly return 403, so it is retried.
  size=""
  for attempt in 1 2 3 4 5; do
    size=$(s3api head-object --bucket "$S3_BUCKET" --key "$version/$name" --query ContentLength --output text 2>/dev/null) && break
    sleep $((attempt * 2))
  done
  [ "$size" = "$(wc -c < "$dir/$name" | tr -d ' ')" ] || { echo "uploaded size mismatch for $name" >&2; exit 1; }
  echo "uploaded $version/$name ($size bytes)"
done
[ -f "$dir/SHA256SUMS" ] && s3 cp "$dir/SHA256SUMS" "s3://$S3_BUCKET/$version/SHA256SUMS" --only-show-errors
s3 cp "$manifest" "s3://$S3_BUCKET/$version/release.json" --content-type application/json --only-show-errors

# Keep the manifest being replaced, so a bad release can be rolled back by restoring it.
if s3api head-object --bucket "$S3_BUCKET" --key latest.json >/dev/null 2>&1; then
  s3 cp "s3://$S3_BUCKET/latest.json" "s3://$S3_BUCKET/previous.json" --only-show-errors
fi
s3 cp "$manifest" "s3://$S3_BUCKET/latest.json" --content-type application/json --only-show-errors
echo "published $version to $S3_BUCKET"
