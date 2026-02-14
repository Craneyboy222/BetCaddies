#!/bin/bash
# AI Super Agent — Skill Quality Validator
# Validates a generated skill against the mandatory structural requirements.
# Usage: ./check-skill-quality.sh /path/to/skill-directory
#
# Exit codes:
#   0 = all checks pass
#   1 = validation failures found (details on stdout)

SKILL_DIR="$1"

if [ -z "$SKILL_DIR" ]; then
  echo "Usage: check-skill-quality.sh /path/to/skill-directory"
  exit 1
fi

SKILL_FILE="$SKILL_DIR/SKILL.md"
ERRORS=0

# Check SKILL.md exists
if [ ! -f "$SKILL_FILE" ]; then
  echo "FAIL: SKILL.md not found at $SKILL_FILE"
  exit 1
fi

# Check YAML frontmatter exists
if ! head -1 "$SKILL_FILE" | grep -q "^---"; then
  echo "FAIL: Missing YAML frontmatter (must start with ---)"
  ERRORS=$((ERRORS + 1))
fi

# Check name field
if ! grep -q "^name:" "$SKILL_FILE"; then
  echo "FAIL: Missing 'name:' in YAML frontmatter"
  ERRORS=$((ERRORS + 1))
fi

# Check description field
if ! grep -q "^description:" "$SKILL_FILE"; then
  echo "FAIL: Missing 'description:' in YAML frontmatter"
  ERRORS=$((ERRORS + 1))
fi

# Check line count (max 500)
LINE_COUNT=$(wc -l < "$SKILL_FILE")
if [ "$LINE_COUNT" -gt 500 ]; then
  echo "FAIL: SKILL.md is $LINE_COUNT lines (max 500). Move detail to references/."
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: SKILL.md is $LINE_COUNT lines (under 500 limit)"
fi

# Check for scope definition
if ! grep -qi "scope" "$SKILL_FILE"; then
  echo "WARN: No scope section found. Consider adding In scope / Out of scope."
fi

# Check for execution phases
if ! grep -qi "phase" "$SKILL_FILE"; then
  echo "WARN: No execution phases found. Consider adding numbered phases."
fi

# Check for output format
if ! grep -qi "output" "$SKILL_FILE"; then
  echo "WARN: No output format section found."
fi

# Check for quality floor
if ! grep -qi "quality\|mediocre\|floor" "$SKILL_FILE"; then
  echo "WARN: No quality floor definition found."
fi

# Check references directory
if [ -d "$SKILL_DIR/references" ]; then
  REF_COUNT=$(ls "$SKILL_DIR/references/"*.md 2>/dev/null | wc -l)
  echo "INFO: Found $REF_COUNT reference files"

  # Check each reference for table of contents if >100 lines
  for ref in "$SKILL_DIR/references/"*.md; do
    if [ -f "$ref" ]; then
      ref_lines=$(wc -l < "$ref")
      if [ "$ref_lines" -gt 100 ]; then
        if ! grep -qi "table of contents\|## Contents\|## TOC" "$ref"; then
          echo "WARN: $(basename "$ref") is $ref_lines lines but has no Table of Contents"
        fi
      fi
    fi
  done
else
  echo "INFO: No references/ directory"
fi

# Summary
if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "RESULT: $ERRORS validation error(s) found. Fix before using."
  exit 1
else
  echo ""
  echo "RESULT: All mandatory checks passed."
  exit 0
fi
