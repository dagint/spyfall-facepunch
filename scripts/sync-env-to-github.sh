#!/usr/bin/env bash
# Syncs all variables from .env to GitHub Actions secrets.
# Requires: gh CLI authenticated (gh auth login)
# Usage: ./scripts/sync-env-to-github.sh [--repo owner/repo]

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI not authenticated. Run: gh auth login" >&2
  exit 1
fi

REPO_FLAG=""
if [[ "${1:-}" == "--repo" && -n "${2:-}" ]]; then
  REPO_FLAG="--repo $2"
fi

echo "Syncing secrets to GitHub Actions..."

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blank lines and comments
  [[ -z "$line" || "$line" =~ ^# ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  # Skip keys with empty values
  if [[ -z "$value" ]]; then
    echo "  Skipping $key (empty value)"
    continue
  fi

  echo "  Setting $key"
  # shellcheck disable=SC2086
  gh secret set "$key" --body "$value" $REPO_FLAG
done < "$ENV_FILE"

echo "Done."
