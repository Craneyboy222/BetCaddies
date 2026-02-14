#!/bin/bash
# AI Super Agent — Task Complexity Classifier
# Reads the user prompt from stdin and outputs a classification signal.
# Called by hooks/hooks.json on UserPromptSubmit.
#
# Output format (to stdout, read by the agent):
#   COMPLEXITY=SIMPLE|MEDIUM|COMPLEX|META|BYPASS
#
# This is a heuristic pre-classifier. The agent's Phase 0 makes the final
# determination, but this gives it a head start.

INPUT="$(cat)"
INPUT_LOWER="$(echo "$INPUT" | tr '[:upper:]' '[:lower:]')"

# Check for BYPASS signals first
if echo "$INPUT_LOWER" | grep -qE '\b(quick|just|briefly|skip optimization|skip)\b'; then
  echo "COMPLEXITY=BYPASS"
  exit 0
fi

# Check for META signals
if echo "$INPUT_LOWER" | grep -qE '\b(create a skill|configure agent|improve yourself|optimize pipeline|self-improve|add a skill|install skill|manage skills|keybindings|settings\.json|mcp server)\b'; then
  echo "COMPLEXITY=META"
  exit 0
fi

# Check for COMPLEX signals
if echo "$INPUT_LOWER" | grep -qE '\b(full|complete|enterprise|production-ready|comprehensive|thorough|deep|build.*app|build.*system|build.*platform|migrate|audit.*entire|full-stack)\b'; then
  echo "COMPLEXITY=COMPLEX"
  exit 0
fi

# Check for MEDIUM signals
if echo "$INPUT_LOWER" | grep -qE '\b(build|create|implement|design|write.*api|debug|refactor|analyze|review)\b'; then
  echo "COMPLEXITY=MEDIUM"
  exit 0
fi

# Default to SIMPLE
echo "COMPLEXITY=SIMPLE"
