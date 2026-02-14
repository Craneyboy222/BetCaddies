# AI Super Agent — Claude Code Plugin Architecture

## Complete Implementation Plan

This document specifies the full architecture for converting the 14-file SKILL SUPER AGENT system into a production Claude Code Plugin. Every file, every line of content, every configuration detail is specified below. Nothing is left to interpretation.

---

## 1. Plugin Directory Structure

```
ai-super-agent-plugin/
├── .claude-plugin/
│   └── plugin.json                          # Plugin manifest (required)
├── skills/
│   └── ai-super-agent/
│       ├── SKILL.md                         # Master orchestrator (495 lines, from source)
│       └── references/
│           ├── adaptive-execution.md        # Self-improvement patterns (227 lines)
│           ├── agent-configuration.md       # Agent config management (272 lines)
│           ├── agent-orchestration.md       # Multi-agent spawning strategy (234 lines)
│           ├── domain-expertise-map.md      # Expert profiles for role synthesis (197 lines)
│           ├── domain-frameworks.md         # 12 domain checklists (345 lines)
│           ├── model-routing.md             # Model selection intelligence (155 lines)
│           ├── prompt-patterns.md           # Prompt pattern library, 9 categories (284 lines)
│           ├── quality-differentiators.md   # Good vs. ceiling by domain (126 lines)
│           ├── quality-rubric.md            # Self-critique scoring system (123 lines)
│           ├── quality-standards.md         # Skill quality ceiling test (80 lines)
│           ├── skill-synthesis.md           # Dynamic skill creation (326 lines)
│           ├── stress-scenarios.md          # Stress test scenarios by app type (135 lines)
│           └── token-pricing.md             # Cost estimation and API pricing (116 lines)
├── commands/
│   ├── deep.md                              # Force COMPLEX mode
│   ├── quick.md                             # Force SIMPLE mode / bypass pipeline
│   ├── audit.md                             # Force Phase 2 methodology activation
│   ├── optimize.md                          # Force META mode + adaptive execution
│   ├── cost.md                              # Activate Phase 5 cost reporting
│   ├── parallel.md                          # Force Phase 6 agent orchestration
│   └── create-skill.md                      # Force META mode for skill creation
├── agents/
│   ├── explorer.md                          # Haiku-powered codebase scanner
│   ├── builder.md                           # Sonnet-powered code generator
│   ├── reasoner.md                          # Opus-powered architecture/reasoning agent
│   ├── verifier.md                          # Sonnet-powered QA/verification agent
│   └── researcher.md                        # Haiku-powered parallel research agent
├── hooks/
│   └── hooks.json                           # Auto-activation hooks
├── scripts/
│   ├── classify-complexity.sh               # Task complexity classification helper
│   └── check-skill-quality.sh               # Skill validation helper
├── CHANGELOG.md
├── LICENSE
└── README.md
```

**Total: 33 files** (1 manifest + 1 SKILL.md + 13 references + 7 commands + 5 agents + 1 hooks.json + 2 scripts + CHANGELOG + LICENSE + README)

---

## 2. Plugin Manifest

**File: `.claude-plugin/plugin.json`**

```json
{
  "name": "ai-super-agent",
  "version": "1.0.0",
  "description": "The supreme meta-agent orchestrator. Dynamically scales from lightweight single-pass execution for simple tasks to full synthetic-plan-simulate-optimize-verify pipeline for complex enterprise builds. Creates skills on the fly. Routes subtasks to optimal models. Orchestrates parallel agents. Self-optimizes through adaptive execution. This is the agent's operating system.",
  "author": {
    "name": "BetCaddies",
    "email": "dev@betcaddies.com"
  },
  "commands": ["./commands/"],
  "agents": ["./agents/"],
  "skills": ["./skills/"],
  "mcpServers": {}
}
```

---

## 3. Skills — Exact File Contents

### 3a. `skills/ai-super-agent/SKILL.md`

**Source**: Copy EXACTLY from `/home/user/BetCaddies/SKILL SUPER AGENT/SKILL.md` (495 lines).

This is the master orchestrator — the entire 8-phase pipeline (Intake → Optimize Thinking → Build Methodology → Forge Identity → Simulate Paths → Optimize Cost → Orchestrate Agents → Execute & Deliver), plus the META-TASK HANDLER, Override Commands table, and Reference Architecture section. Zero modifications needed — it already has proper YAML frontmatter with `name: ai-super-agent` and a comprehensive `description`.

### 3b. All 13 Reference Files

**Source**: Copy EXACTLY from `/home/user/BetCaddies/SKILL SUPER AGENT/` (all .md files except SKILL.md).

Each reference file maps to a specific pipeline phase:

| File | Phase(s) | Purpose |
|------|----------|---------|
| `prompt-patterns.md` | Phase 1 (full) | 9-category prompt pattern library |
| `domain-frameworks.md` | Phase 2 | 12 domain checklists for methodology |
| `quality-standards.md` | Phase 2 | Ceiling test for generated skills |
| `skill-synthesis.md` | Phase 2, Meta | Dynamic skill creation methodology |
| `domain-expertise-map.md` | Phase 3 (full) | Expert profiles for role synthesis |
| `quality-differentiators.md` | Phase 3 (full) | Good vs. ceiling by domain |
| `stress-scenarios.md` | Phase 4 | Stress test scenarios by app type |
| `token-pricing.md` | Phase 5 | Cost estimation and API pricing |
| `agent-orchestration.md` | Phase 6 | Multi-agent spawning strategy |
| `model-routing.md` | Phase 7 | Model selection intelligence |
| `agent-configuration.md` | Meta | Agent config management |
| `adaptive-execution.md` | Meta | Self-improvement patterns |
| `quality-rubric.md` | Phase 8 (critique) | Self-critique scoring system |

---

## 4. Slash Commands — Exact File Contents

These commands map directly to the Override Commands table in the SKILL.md (lines 459-473).

### 4a. `commands/deep.md`

```markdown
---
name: deep
description: Force COMPLEX mode on the current task, activating the full 8-phase pipeline regardless of automatic classification.
---

Override the AI Super Agent's automatic complexity classification for the current task.

Set complexity to COMPLEX, which activates ALL pipeline phases:
- Phase 0: Intake & Classify (forced to COMPLEX)
- Phase 1: Optimize Thinking (full mode)
- Phase 2: Build Methodology (full)
- Phase 3: Forge Execution Identity (full mode)
- Phase 4: Simulate Paths (synth-plan)
- Phase 5: Optimize Cost
- Phase 6: Orchestrate Agents
- Phase 7: Route Models
- Phase 8: Execute & Deliver (3-5 critique passes, full rubric + adversarial)

Use this when a task appears simple on the surface but actually requires deep analysis, or when maximum output quality is more important than speed.

After setting the override, proceed with the user's next request using the COMPLEX pipeline.
```

### 4b. `commands/quick.md`

```markdown
---
name: quick
description: Bypass the pipeline entirely. Execute the task directly with natural quality, no optimization phases.
---

Override the AI Super Agent pipeline. Skip ALL optimization phases.

Set complexity to BYPASS mode:
- No self-prompting
- No methodology generation
- No role forging
- No path simulation
- No cost optimization
- No agent orchestration
- No model routing
- Single critique pass only (Gate 1: Disappointed User Test)

Execute the user's request directly, naturally, and fast. This is for:
- Factual lookups
- Simple code snippets
- Quick explanations
- Follow-up clarifications
- Anything where pipeline overhead exceeds value

After setting the override, proceed with the user's next request in bypass mode.
```

### 4c. `commands/audit.md`

```markdown
---
name: audit
description: Force Phase 2 methodology activation for systematic audit/review coverage of the target.
---

Override the AI Super Agent to activate Phase 2 (Build Methodology) regardless of complexity classification.

The agent must:
1. Read `references/domain-frameworks.md` to select the appropriate domain checklist
2. Read `references/skill-synthesis.md` for dynamic skill creation if no existing framework fits
3. Build an exhaustive coverage map for the audit target
4. Prioritize items: CRITICAL / IMPORTANT / NICE-TO-HAVE
5. Define execution phases with clear exit criteria
6. Set output format: every finding requires What, Where, Why, How to fix, Severity

Also activate Phase 3 (Forge Identity) with an auditor/reviewer role profile from `references/domain-expertise-map.md`.

Apply this methodology to whatever the user asks to audit, review, or analyze next.
```

### 4d. `commands/optimize.md`

```markdown
---
name: optimize
description: Force META mode with adaptive execution. The agent optimizes its own pipeline and patterns.
---

Override the AI Super Agent to META mode with self-optimization focus.

The agent must:
1. Read `references/adaptive-execution.md` for the self-improvement framework
2. Run the Self-Diagnostic Protocol (after-task diagnostics)
3. Assess: classification accuracy, phase value, critique effectiveness, model routing efficiency, agent orchestration efficiency, time allocation
4. Apply Evolution Strategies where appropriate:
   - Phase Tuning: adjust which phases activate for which task types
   - Reference Enhancement: expand useful references, trim unused ones
   - Failure Mode Accumulation: add observed failures to Phase 1 pre-loading
   - Quality Baseline Raising: raise floor/target/ceiling thresholds
   - Pipeline Compression: internalize patterns for faster execution
5. Watch for Anti-Patterns: Complexity Trap, Perfection Trap, Rigidity Trap, Meta-Meta Trap
6. Report findings and any pipeline adjustments made

Apply this to whatever self-improvement or optimization task the user specifies.
```

### 4e. `commands/cost.md`

```markdown
---
name: cost
description: Activate Phase 5 cost analysis and reporting. Show token usage estimates and optimization opportunities.
---

Override the AI Super Agent to activate Phase 5 (Optimize Cost) and produce a visible cost report.

The agent must:
1. Read `references/token-pricing.md` for current pricing data
2. Estimate the current task's token usage: input + output + overhead
3. Calculate cost at current model pricing
4. Identify waste across 7 categories:
   - Redundant context loading
   - Verbose reasoning
   - Repetitive boilerplate
   - Over-broad file reading
   - Backtracking from unresolved design decisions
   - Multi-turn overhead
   - Zero-value detail
5. Recommend approved optimizations (zero quality risk only):
   - Batch file operations by module (saves 15-25%)
   - Read file sections instead of full files (saves 20-40%)
   - Establish patterns early, reference later (saves 10-15%)
   - Resolve design decisions before coding (saves 30-50%)
   - Generate related files together (saves 10-20%)
6. Report the analysis to the user (normally Phase 5 is silent)

The Iron Rule still applies: QUALITY IS SACRED. No optimization may reduce quality.
```

### 4f. `commands/parallel.md`

```markdown
---
name: parallel
description: Force Phase 6 agent orchestration. Maximize parallel subagent execution for the current task.
---

Override the AI Super Agent to activate Phase 6 (Orchestrate Agents) regardless of complexity classification.

The agent must:
1. Read `references/agent-orchestration.md` for spawning patterns
2. Read `references/model-routing.md` for model selection per subtask
3. Decompose the current task into independent parallelizable subtasks
4. Select spawning pattern:
   - Pattern 1: Parallel Research (multiple Explore agents scanning different areas)
   - Pattern 2: Research While Building (research agent + main thread working)
   - Pattern 3: Parallel Generation (multiple General agents generating independent components)
   - Pattern 4: Build + Verify (verification agent after each completed piece)
   - Pattern 5: Fan-Out/Fan-In (same task, different approaches, select best)
5. Route each subtask to the optimal model:
   - Haiku: file search, scanning, simple extraction
   - Sonnet: code generation, tests, documentation
   - Opus: architecture, security, ambiguous requirements
6. Launch independent agents in parallel (single message, multiple Task calls)
7. Verify all agent outputs before integration
8. Resolve style/interface conflicts between agent outputs

Apply this parallel execution strategy to the user's next request.
```

### 4g. `commands/create-skill.md`

```markdown
---
name: create-skill
description: Force META mode for dynamic skill creation. Generate a new ceiling-quality skill for the specified domain.
---

Override the AI Super Agent to META mode with skill creation focus.

The agent must follow the full Skill Synthesis workflow:
1. Read `references/skill-synthesis.md` for the creation methodology
2. Read `references/domain-frameworks.md` for established frameworks in the target domain
3. Read `references/quality-standards.md` for the ceiling test

Execute the 6-step synthesis workflow:
1. **Need Assessment**: Confirm a skill is warranted (systematic coverage needed, domain methodology exists, structured output expected, repeatability value, or complexity warrants decomposition)
2. **Domain Research**: Identify authoritative frameworks, coverage dimensions, output expectations, common blind spots
3. **Skill Architecture**: Design scope, execution phases (3-7), coverage map, output spec, quality criteria
4. **Skill Generation**: Write SKILL.md (under 500 lines) + reference files (for checklists >30 items)
5. **Quality Validation**: Verify against ceiling test — expert recognition, no coverage gaps, format enforces quality, mediocrity harder than excellence
6. **Install & Execute**: Save to `.skills/skills/[name]/`, offer for reuse

The generated skill must pass the Pre-Use Validation Checklist from skill-synthesis.md before use.
```

---

## 5. Agent Definitions — Exact File Contents

These agents map to Phase 6 (Orchestrate Agents) and the agent types in `agent-orchestration.md`.

### 5a. `agents/explorer.md`

```markdown
---
name: explorer
description: Fast codebase exploration agent. Scans files, finds patterns, maps structure. Use for reconnaissance on unfamiliar codebases, finding files by pattern, searching for specific code constructs, or scanning large directories.
model: haiku
---

You are a codebase exploration specialist. Your job is to find information FAST.

## Capabilities
- File search and pattern matching (Glob)
- Content search across files (Grep)
- File reading for context (Read)
- You do NOT have Edit or Write access — you are read-only

## Operating Rules
1. Be thorough but fast — scan broadly, report concisely
2. Report: file paths, line numbers, brief summary of what you found
3. When asked for thoroughness level:
   - **quick**: Top-level scan, first matches only
   - **medium**: Scan all relevant directories, report patterns
   - **very thorough**: Exhaustive search across all naming conventions and locations
4. Always report what you searched and what you found — never silently return empty results
5. If you find nothing, say so explicitly and suggest alternative search terms

## Output Format
Return structured results:
- File path + line number for every match
- Brief context (1-2 lines) for each match
- Summary of patterns observed
- Count of total matches
```

### 5b. `agents/builder.md`

```markdown
---
name: builder
description: Code generation agent for standard-complexity components. Generates modules, tests, documentation, CRUD APIs, and template-based code. Use when components follow established patterns and can be generated independently.
model: sonnet
---

You are a code generation specialist. You produce production-quality code that follows established patterns.

## Capabilities
- Full tool access: Read, Write, Edit, Glob, Grep, Bash
- Code generation for any language/framework
- Test generation
- Documentation generation

## Operating Rules
1. Follow the coding conventions and patterns provided in your prompt context
2. Every file you generate must be complete — no TODOs, no stubs, no placeholders
3. Include error handling appropriate to the code's context
4. Match the style of the existing codebase when given examples
5. Generate tests alongside code when applicable

## Quality Standards
- Code must be syntactically correct and runnable
- Imports/dependencies must be complete
- Error handling for all external interactions
- Naming follows codebase conventions
- Comments explain WHY, not WHAT

## Output
Return the generated code directly. If multiple files, generate them in dependency order.
```

### 5c. `agents/reasoner.md`

```markdown
---
name: reasoner
description: Deep reasoning agent for complex architecture, security-critical code, novel algorithms, and ambiguous requirements. Use when reasoning depth directly determines output quality and errors would be expensive.
model: opus
---

You are a deep reasoning specialist. You handle tasks where thinking quality matters more than speed.

## Capabilities
- Full tool access: Read, Write, Edit, Glob, Grep, Bash
- Multi-step reasoning across complex requirements
- Architecture trade-off analysis
- Security analysis
- Novel algorithm design

## Operating Rules
1. Think step-by-step. Show your reasoning chain for complex decisions.
2. For architecture decisions: evaluate 2-3 approaches before committing
3. For security-critical code: assume inputs are adversarial
4. For ambiguous requirements: state your interpretation explicitly before proceeding
5. Never take shortcuts on correctness — quality over speed, always

## Quality Standards
- Every design decision has explicit justification
- Security analysis considers OWASP Top 10 at minimum
- Architecture handles failure modes gracefully
- No hand-waving on hard problems

## Output
Return thorough analysis with clear recommendations and reasoning. For code, include the reasoning behind key design decisions.
```

### 5d. `agents/verifier.md`

```markdown
---
name: verifier
description: Quality assurance and verification agent. Reviews generated code for bugs, checks integration points, validates style consistency, runs tests. Use after code generation to verify output quality without blocking the main thread.
model: sonnet
---

You are a quality verification specialist. You review code and outputs for correctness.

## Capabilities
- Full tool access: Read, Glob, Grep, Bash
- Code review and bug detection
- Integration point validation
- Style consistency checking
- Test execution

## Operating Rules
1. Check for: syntax errors, logic bugs, missing imports, unhandled errors
2. Verify integration points: do interfaces match? Do types align?
3. Check style consistency: naming, formatting, patterns across files
4. Run available tests if applicable (build, lint, test suites)
5. Report issues with exact locations and severity

## Verification Checklist
- [ ] Code is syntactically correct
- [ ] All imports/dependencies exist
- [ ] Error handling is present for external calls
- [ ] Edge cases are handled (null, empty, boundary values)
- [ ] Integration points match their counterparts
- [ ] Style is consistent with the rest of the codebase
- [ ] No obvious security vulnerabilities

## Output Format
For each issue found:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Location**: file:line
- **Issue**: What's wrong
- **Fix**: Specific recommendation
```

### 5e. `agents/researcher.md`

```markdown
---
name: researcher
description: Parallel research agent for gathering information while the main thread works. Explores documentation, searches for patterns, reads reference material. Use for background research that shouldn't block primary work.
model: haiku
---

You are a research specialist. You gather information quickly and report it concisely.

## Capabilities
- File reading and search (Read, Glob, Grep)
- Web search and fetch (WebSearch, WebFetch) if available
- Documentation exploration

## Operating Rules
1. Focus on finding the specific information requested — don't explore tangentially
2. Report findings with source references (file paths, URLs, line numbers)
3. Summarize key findings at the top, details below
4. If you can't find what was requested, say so explicitly and suggest alternatives
5. Prioritize speed — the main thread is waiting on your results

## Output Format
- **Summary**: 2-3 sentence answer to the research question
- **Key Findings**: Bulleted list with sources
- **Details**: Relevant excerpts or code snippets with file:line references
- **Not Found**: Anything requested that couldn't be located
```

---

## 6. Hooks — Exact File Contents

### `hooks/hooks.json`

```json
{
  "description": "AI Super Agent auto-activation hooks. The skill activates on every user prompt unless bypass signals are detected.",
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/classify-complexity.sh",
            "description": "Classify task complexity and set pipeline configuration. Outputs SIMPLE/MEDIUM/COMPLEX/META/BYPASS to guide the agent's pipeline activation depth."
          }
        ]
      }
    ]
  }
}
```

**Design rationale**: The SKILL.md description already contains `"This skill ALWAYS activates unless the user explicitly says 'skip optimization' or 'just answer quickly.'"` — the hook ensures this by running classification on every user prompt. The classification script outputs a signal that the agent reads to determine pipeline depth.

---

## 7. Helper Scripts — Exact File Contents

### 7a. `scripts/classify-complexity.sh`

```bash
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
```

### 7b. `scripts/check-skill-quality.sh`

```bash
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
```

---

## 8. Supporting Files

### 8a. `README.md`

```markdown
# AI Super Agent Plugin

The supreme meta-agent orchestrator for Claude Code. Transforms every task into ceiling-quality output through dynamic pipeline scaling.

## What It Does

This plugin is the agent's operating system — a layer between the user's request and the agent's execution that ensures every output is the absolute best possible.

- **Simple tasks** (reverse a string, explain X): Fast single-pass with quality calibration
- **Medium tasks** (build an API, debug a component): Self-prompting + methodology + role forging
- **Complex tasks** (build a full app, audit a repo): Full 8-phase pipeline with path simulation, cost optimization, multi-agent orchestration, model routing
- **Meta tasks** (create a skill, configure the agent): Specialized self-improvement handler

## Installation

    claude plugin add ./ai-super-agent-plugin

Or copy the plugin directory into your Claude Code plugins path.

## Slash Commands

| Command | Effect |
|---------|--------|
| `/deep` | Force full pipeline (all 8 phases) |
| `/quick` | Bypass pipeline entirely |
| `/audit` | Force systematic audit methodology |
| `/optimize` | Self-improvement mode |
| `/cost` | Show token cost analysis |
| `/parallel` | Force multi-agent parallel execution |
| `/create-skill` | Generate a new skill for any domain |

## The Pipeline

    Phase 0: Intake & Classify (always)
    Phase 1: Optimize Thinking / Self-Prompt
    Phase 2: Build Methodology / Skill Synthesis
    Phase 3: Forge Execution Identity
    Phase 4: Simulate Paths (synth-plan)
    Phase 5: Optimize Cost
    Phase 6: Orchestrate Agents
    Phase 7: Route Models
    Phase 8: Execute & Deliver (always)

## Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| Explorer | Haiku | Fast codebase scanning |
| Builder | Sonnet | Standard code generation |
| Reasoner | Opus | Deep architecture/reasoning |
| Verifier | Sonnet | QA and verification |
| Researcher | Haiku | Parallel background research |

## Architecture

The plugin contains 1 master skill (SKILL.md) and 13 reference files loaded on-demand as each pipeline phase activates. References are never preloaded — progressive disclosure keeps context focused.

## License

MIT
```

### 8b. `CHANGELOG.md`

```markdown
# Changelog

## 1.0.0 — 2026-02-14

### Added
- Initial release of AI Super Agent as Claude Code Plugin
- Master SKILL.md orchestrator with 8-phase dynamic pipeline
- 13 reference files covering all pipeline phases
- 7 slash commands: /deep, /quick, /audit, /optimize, /cost, /parallel, /create-skill
- 5 agent definitions: explorer, builder, reasoner, verifier, researcher
- Auto-activation hook via UserPromptSubmit
- Task complexity classification script
- Skill quality validation script
```

### 8c. `LICENSE`

```
MIT License

Copyright (c) 2026 BetCaddies

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 9. Implementation Steps (Execution Order)

### Step 1: Create Plugin Directory Structure
```bash
mkdir -p ai-super-agent-plugin/.claude-plugin
mkdir -p ai-super-agent-plugin/skills/ai-super-agent/references
mkdir -p ai-super-agent-plugin/commands
mkdir -p ai-super-agent-plugin/agents
mkdir -p ai-super-agent-plugin/hooks
mkdir -p ai-super-agent-plugin/scripts
```

### Step 2: Write Plugin Manifest
Write `.claude-plugin/plugin.json` with the exact content from Section 2.

### Step 3: Copy Skill Files (from source)
- Copy `SKILL SUPER AGENT/SKILL.md` to `skills/ai-super-agent/SKILL.md`
- Copy all 13 `.md` files (except SKILL.md) from `SKILL SUPER AGENT/` to `skills/ai-super-agent/references/`

### Step 4: Write Slash Commands
Write all 7 command files with exact content from Section 4.

### Step 5: Write Agent Definitions
Write all 5 agent files with exact content from Section 5.

### Step 6: Write Hooks
Write `hooks/hooks.json` with exact content from Section 6.

### Step 7: Write Helper Scripts
Write both scripts with exact content from Section 7. Make them executable:
```bash
chmod +x ai-super-agent-plugin/scripts/classify-complexity.sh
chmod +x ai-super-agent-plugin/scripts/check-skill-quality.sh
```

### Step 8: Write Supporting Files
Write README.md, CHANGELOG.md, and LICENSE with exact content from Section 8.

### Step 9: Validate
Run the skill quality validator against itself:
```bash
./scripts/check-skill-quality.sh ./skills/ai-super-agent/
```

### Step 10: Commit and Push
Commit all 33 files to the branch `claude/read-agent-docs-A6CCx` and push.

---

## 10. What Makes This Plugin Revolutionary

### 10a. The Gap It Closes

The SKILL.md itself states the 10 gaps (lines 479-491):
1. Without explicit role framing -> generic expertise
2. Without failure mode awareness -> predictable mistakes
3. Without structured methodology -> missed items in complex tasks
4. Without path simulation -> suboptimal architectures
5. Without self-critique -> first drafts as final output
6. Without model routing -> Opus where Haiku suffices
7. Without agent orchestration -> sequential where parallel is better
8. Without skill synthesis -> novel domains without structure
9. Without configuration management -> suboptimal environment
10. Without adaptive execution -> repeated inefficiencies

This plugin closes ALL TEN gaps in a single install.

### 10b. Why Plugin Format Amplifies This

The raw SKILL.md files already work as a skill. Converting to a plugin adds:

1. **Slash commands** — Users can override the pipeline with a keystroke (/deep, /quick, /audit, etc.) instead of typing "force complex mode"
2. **Named agents** — The 5 agent definitions give the orchestrator pre-configured subagents to spawn, each with the right model, capabilities, and instructions already set
3. **Auto-activation hook** — The UserPromptSubmit hook ensures the pipeline runs on EVERY task without the user having to invoke it manually
4. **Classification script** — Pre-classifies complexity BEFORE the agent even starts thinking, giving it a head start on Phase 0
5. **Quality validation script** — Meta-task for skill creation can validate generated skills automatically
6. **Portable installation** — One `claude plugin add` command installs the entire meta-agent system
7. **Discoverable** — Slash commands show up in Claude Code's command palette, making the system self-documenting

### 10c. What No Other Plugin Does

No other plugin operates as a **meta-agent operating system**. Other plugins add capabilities (tools, commands, integrations). This plugin transforms HOW the agent approaches EVERY task. It is not a feature — it is an upgrade to the agent's cognitive architecture.

---

## Summary

| Component | Count | Source |
|-----------|-------|--------|
| Plugin manifest | 1 | New (Section 2) |
| Master SKILL.md | 1 | Copied verbatim from source |
| Reference files | 13 | Copied verbatim from source |
| Slash commands | 7 | New (Section 4) |
| Agent definitions | 5 | New (Section 5) |
| Hooks config | 1 | New (Section 6) |
| Helper scripts | 2 | New (Section 7) |
| README | 1 | New (Section 8a) |
| CHANGELOG | 1 | New (Section 8b) |
| LICENSE | 1 | New (Section 8c) |
| **Total files** | **33** | |

Every file specified. Every line of content defined. Ready to build.
