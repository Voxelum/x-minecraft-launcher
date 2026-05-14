#!/usr/bin/env bash
#
# scripts/post-screenshots.sh — host scratch-spec screenshots in a public
# gist, then post a PR comment that embeds them inline via the gist's raw
# URLs. Used by the GitHub Copilot agent (and human contributors) for
# visual verification of UI changes.
#
# Why a gist?
#   - GitHub does not expose its drag-and-drop image-upload endpoint to
#     bots, so we cannot use `https://github.com/user-attachments/...`.
#   - Committing PNGs to the PR branch (the previous approach) pollutes
#     the file diff and hurts code review.
#   - A gist keeps the binaries out of the repo while still giving us
#     stable raw URLs that render inline in PR comments.
#
# Usage:
#   scripts/post-screenshots.sh <spec-slug> [pr-number]
#
# Example:
#   scripts/post-screenshots.sh servers-tab-empty-state-and-add-dialog
#
# Requires: bash, gh (logged in), jq, find, sort.

set -euo pipefail

slug="${1:?usage: $0 <spec-slug> [pr-number]}"
pr_number="${2:-}"

shots_dir="e2e/artifacts/screenshots/en/${slug}"
manifest="${shots_dir}/manifest.json"

if [[ ! -d "${shots_dir}" ]]; then
  echo "error: no screenshots at ${shots_dir}" >&2
  echo "hint: run \`pnpm test:e2e:scratch\` first" >&2
  exit 1
fi

# Sorted PNG list — the leading "01-", "02-" ordering is intentional.
mapfile -t pngs < <(find "${shots_dir}" -maxdepth 1 -name '*.png' | sort)
if [[ ${#pngs[@]} -eq 0 ]]; then
  echo "error: no PNGs in ${shots_dir}" >&2
  exit 1
fi

# Auto-detect PR number from the current branch when not supplied.
if [[ -z "${pr_number}" ]]; then
  pr_number=$(gh pr view --json number --jq .number)
fi

echo "→ Creating gist with ${#pngs[@]} screenshot(s)…"
gist_url=$(gh gist create --public \
  --desc "Visual verification for PR #${pr_number} (${slug})" \
  "${pngs[@]}")
gist_id=$(basename "${gist_url}")

# Look up each file's content-addressed raw_url. Sorted by key so the
# table reads in step order.
table=$(gh api "gists/${gist_id}" --jq '
  .files
  | to_entries
  | sort_by(.key)
  | map("| `\(.key)` | ![\(.key)](\(.value.raw_url)) |")
  | join("\n")
')

# Optional: pull captions from the journey manifest written by shoot().
caption_table=""
if [[ -f "${manifest}" ]] && command -v jq >/dev/null; then
  caption_table=$(jq -r '
    .shots
    | sort_by(.step)
    | map("| `\(.step).png` | \(.caption) |")
    | join("\n")
  ' "${manifest}")
fi

body_file=$(mktemp)
{
  echo "### Visual verification — \`${slug}\`"
  echo
  echo "| Step | Screenshot |"
  echo "|---|---|"
  echo "${table}"
  if [[ -n "${caption_table}" ]]; then
    echo
    echo "<details><summary>Captions</summary>"
    echo
    echo "| Step | Caption |"
    echo "|---|---|"
    echo "${caption_table}"
    echo
    echo "</details>"
  fi
  echo
  echo "<sub>Gist: ${gist_url} · Spec: \`e2e/specs/scratch/${slug}.spec.ts\`</sub>"
} > "${body_file}"

echo "→ Posting comment to PR #${pr_number}…"
gh pr comment "${pr_number}" --body-file "${body_file}"
rm -f "${body_file}"

echo
echo "✓ Done."
echo "  Gist: ${gist_url}"
echo "  PR:   $(gh pr view "${pr_number}" --json url --jq .url)"
