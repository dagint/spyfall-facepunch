#!/usr/bin/env bash
# Auto-bump patch version in package.json and CHANGELOG.md on each commit.
# Called via the pre-commit git hook.

set -e

# Read current version from package.json
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Add an Unreleased section to CHANGELOG.md if not present, update version
DATE=$(date +%Y-%m-%d)
if grep -q "## \[Unreleased\]" CHANGELOG.md 2>/dev/null; then
  # Replace [Unreleased] with the new version
  sed -i "s/## \[Unreleased\]/## [$NEW_VERSION] - $DATE/" CHANGELOG.md
fi

# Re-stage the bumped files
git add package.json CHANGELOG.md
