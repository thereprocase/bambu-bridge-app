#!/usr/bin/env bash
# export-release.sh â€” produce a clean release tree from tracked git files only.
#
# Usage: bash scripts/export-release.sh <output-directory>
#
# Exports HEAD via 'git archive' (tracked files only) into <output-directory>,
# then aborts if any agent/dev cruft is present in the result.

set -euo pipefail

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
    echo "Usage: $0 <output-directory>" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -e "$DEST" ]]; then
    echo "error: destination already exists: $DEST" >&2
    exit 1
fi

mkdir -p "$DEST"

echo "Exporting HEAD from $REPO_ROOT -> $DEST ..."
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$DEST"

echo "Checking for agent/dev cruft ..."

# Files and patterns that must NOT appear in a release export.
# If any are present they are either tracked when they should be gitignored,
# or the .gitignore / .gitattributes needs an export-ignore entry.
CRUFT_PATTERNS=(
    ".claude"
    "AGENTS.md"
    "CLAUDE.md"
    "dev-notes"
    "*.apk"
    "AGENT-BRIEF.md"
    "*.keystore"
    "*.jks"
    "local.properties"
    ".env*"
    "captures"
)

FOUND_CRUFT=0
for pattern in "${CRUFT_PATTERNS[@]}"; do
    # Use find with -name for glob patterns, -path for directory names
    matches=$(find "$DEST" -name "$pattern" 2>/dev/null || true)
    if [[ -n "$matches" ]]; then
        echo "FAIL: cruft found matching '$pattern':" >&2
        echo "$matches" >&2
        FOUND_CRUFT=1
    fi
done

if [[ "$FOUND_CRUFT" -ne 0 ]]; then
    echo "" >&2
    echo "Release tree contains agent/dev cruft. Fix by either:" >&2
    echo "  1. Adding the file(s) to .gitignore (if they should never be tracked), OR" >&2
    echo "  2. Adding 'export-ignore' to .gitattributes for files that are tracked" >&2
    echo "     but should be excluded from release exports." >&2
    echo "" >&2
    echo "Incomplete export retained for inspection: $DEST" >&2
    exit 2
fi

echo "Export clean: $DEST"
echo "Contents:"
find "$DEST" -maxdepth 2 | sort
