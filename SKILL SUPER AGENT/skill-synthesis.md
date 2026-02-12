# Dynamic Skill Synthesis

Comprehensive methodology for creating purpose-built skills on the fly. When the agent
encounters a task that would benefit from a structured, repeatable methodology, this
reference guides the creation of a ceiling-quality skill before executing the task.

---

## Table of Contents

1. [When to Synthesize](#when-to-synthesize)
2. [The Synthesis Workflow](#the-synthesis-workflow)
3. [Domain Research Protocol](#domain-research-protocol)
4. [Skill Architecture Standards](#skill-architecture-standards)
5. [SKILL.md Template](#skillmd-template)
6. [Reference File Template](#reference-file-template)
7. [Quality Validation](#quality-validation)
8. [Installation and Use](#installation-and-use)

---

## When to Synthesize

### Generate a New Skill When ANY of These Are True
1. **Systematic coverage needed** — The task requires checking many things (audits,
   reviews, migrations). Ad-hoc approaches inevitably miss items.
2. **Domain methodology exists** — Established best practices, checklists, or frameworks
   should be followed (security audits, code reviews, accessibility checks).
3. **Structured output expected** — User expects a report, scorecard, or organized
   deliverable, not stream-of-consciousness.
4. **Repeatability value** — The skill could be reused on similar tasks.
5. **Complexity warrants decomposition** — Enough moving parts that a defined workflow
   prevents dropped balls.

### Do NOT Synthesize When
- Task is simple enough for direct execution
- User explicitly wants a quick, informal answer
- Creating the skill would take longer than doing the work
- An existing skill already covers this task type

### Task-to-Skill Mapping

| Task Pattern | Skill Type | Example |
|-------------|-----------|---------|
| "audit this X" | Audit skill | code-audit, security-audit, perf-audit |
| "review this X" | Review skill | api-review, architecture-review |
| "analyze this X" | Analysis skill | data-analysis, competitive-analysis |
| "migrate X to Y" | Migration skill | ts-migration, db-migration |
| "set up X" | Setup skill | cicd-setup, monorepo-setup |
| "build a pipeline for X" | Pipeline skill | data-pipeline, deploy-pipeline |
| "test X comprehensively" | Testing skill | test-suite-gen, e2e-testing |
| "document X" | Documentation skill | api-docs, architecture-docs |

---

## The Synthesis Workflow

```
1. NEED ASSESSMENT     <- Does this need a skill? Or can existing tools handle it?
       |
       v
2. DOMAIN RESEARCH     <- What does world-class look like for this task?
       |
       v
3. SKILL ARCHITECTURE  <- Design the skill structure before writing
       |
       v
4. SKILL GENERATION    <- Write SKILL.md + reference files
       |
       v
5. QUALITY VALIDATION  <- Verify against ceiling test
       |
       v
6. INSTALL & EXECUTE   <- Save, read, use on the actual task
```

---

## Domain Research Protocol

Before writing the skill, research what excellence looks like. This step transforms
a mediocre skill into an expert-level methodology.

### Research Steps

1. **Identify the domain** — What category of work is this? Be specific (not "code review"
   but "React component architecture review" or "API idempotency audit").

2. **Identify authoritative frameworks** — What do experts actually use?
   - Read `references/domain-frameworks.md` for 12 common domains
   - If the domain isn't covered, research from training knowledge
   - If web search is available, search for current best practices

3. **Identify coverage dimensions** — What are ALL the things to check or address?
   Aim for exhaustive. Easier to trim than to discover gaps mid-execution.

4. **Identify output expectations** — What does a professional deliverable look like?
   What format do stakeholders expect?

5. **Identify common blind spots** — What do mediocre versions consistently miss?
   These become explicit checklist items in the skill.

---

## Skill Architecture Standards

### Required Components

Every synthesized skill must have:

```
1. SCOPE DEFINITION
   - What exactly is covered
   - What is explicitly out of scope
   - Prerequisites and inputs needed

2. EXECUTION PHASES (typically 3-7)
   - Each phase: purpose, inputs, process, outputs, exit criteria
   - Phases build on each other — outputs feed inputs

3. COVERAGE MAP
   - Exhaustive item list organized by category
   - Priority classification: CRITICAL / IMPORTANT / NICE-TO-HAVE
   - Summary in SKILL.md, detail in references for >30 items

4. OUTPUT SPECIFICATION
   - Exact deliverable format (sections, structure)
   - Scoring/rating system if applicable
   - Evidence requirements (show, don't just claim)
   - Actionability requirements (every finding = recommendation)

5. QUALITY CRITERIA
   - What makes good vs. mediocre execution
   - Minimum coverage thresholds
   - Completeness checks
```

### Sizing Rules
- **SKILL.md**: Under 500 lines. This is the operational instruction set.
- **References**: Use for detailed checklists >30 items, lookup tables, framework
  details, or any content over 100 lines that doesn't need to be in the main flow.
- **Scripts**: If the task involves deterministic/repetitive operations, write helper
  scripts in a scripts/ directory.

---

## SKILL.md Template

```markdown
---
name: [task-specific-name]
description: >
  [What this skill does, when to trigger it, what it produces.
   Be specific and slightly aggressive about trigger conditions so
   the skill activates when it should.]
---

# [Skill Name]

[One paragraph: what this skill does and why it exists. Include what makes
this skill better than ad-hoc execution.]

## Scope

**In scope:** [exhaustive list of what's covered]
**Out of scope:** [explicit exclusions with reasoning]
**Prerequisites:** [what's needed before starting]

## Execution Phases

### Phase 1: [Discovery/Setup/Reconnaissance]
**Purpose:** [why this phase exists]
**Process:**
[numbered step-by-step instructions with reasoning]
**Output:** [what this phase produces for the next phase]
**Exit criteria:** [how to know this phase is complete]

### Phase 2: [Core Analysis/Execution]
**Purpose:** [why]
**Process:** [how]
**Output:** [what]
**Exit criteria:** [when]

### Phase N: [Synthesis/Report/Delivery]
...

## Coverage Map

Read `references/[detailed-checklist].md` for the complete coverage list.

Summary of categories:
- Category A: N items (N critical, N important)
- Category B: N items (N critical, N important)
- ...

## Output Format

### Executive Summary
[Brief overview of findings/results — stands alone for quick consumption]

### Detailed Findings
For each finding:
- **What**: [specific issue or result]
- **Where**: [exact location — file, line, component]
- **Why it matters**: [impact and risk assessment]
- **Recommendation**: [specific, actionable fix]
- **Severity**: [CRITICAL / HIGH / MEDIUM / LOW / INFO]

### Scoring (if applicable)
[Rating system with clear criteria for each level]

## Quality Floor

A mediocre version of this output would: [describe concrete mediocre patterns]
This skill produces output that: [describe the standard this skill enforces]
```

---

## Reference File Template

For detailed checklists and lookup tables:

```markdown
# [Category] Checklist

## Table of Contents
1. [Subcategory A] (N items)
2. [Subcategory B] (N items)
...

## Subcategory A

### [CRITICAL] Item Name
- **Check**: [What to look for — specific, actionable]
- **Why**: [Why this matters — concrete impact]
- **Good**: [Example of what passing looks like]
- **Bad**: [Example of what failing looks like]
- **Fix**: [How to resolve if found]

### [IMPORTANT] Item Name
- **Check**: ...
- **Why**: ...
...
```

### Reference File Rules
- Table of contents for files over 100 lines
- Items prioritized: CRITICAL / IMPORTANT / NICE-TO-HAVE
- Each item: what to check, why it matters, what good/bad looks like
- Organized by logical category
- Concrete over abstract — every item must be actually checkable

---

## Quality Validation

### The Ceiling Test
A synthesized skill is at the ceiling when:

1. **An expert would recognize the methodology as thorough** — Not "a good start" but
   "yes, this covers what I would check."

2. **The coverage map has no obvious gaps** — If someone can immediately name something
   the skill should check but doesn't, it's not at the ceiling.

3. **The output format enforces quality** — The template makes it impossible to produce
   a lazy deliverable. Every finding requires evidence, location, impact, and fix.

4. **The skill makes mediocrity harder than excellence** — The structure, checklists,
   and requirements push toward completeness.

### Pre-Use Validation Checklist
- [ ] Every abstract instruction decomposes into concrete, checkable items
- [ ] Coverage map is exhaustive for the domain (nothing obvious missing)
- [ ] Output format specifies evidence requirements
- [ ] Every finding template requires a specific fix recommendation
- [ ] Quality floor is defined (what mediocre looks like)
- [ ] Phases have clear exit criteria and handoff outputs
- [ ] Would produce meaningfully better results than ad-hoc work
- [ ] Reference files exist for any checklist over 30 items
- [ ] SKILL.md is under 500 lines

If any check fails, fix the skill before using it.

---

## Installation and Use

### Save the Skill
```bash
mkdir -p .skills/skills/[skill-name]/references
# Write SKILL.md and reference files
```

### Use the Skill
1. Read your own SKILL.md — loads it into active context as working instructions
2. Execute the original task using the skill as methodology
3. Follow the phases, use the checklists, produce the specified output format
4. Save deliverables and present to user

### Offer for Reuse
After using a generated skill, let the user know: "I created a [skill-name]
methodology for this task. It's saved at [path] if you want to reuse it on
similar tasks."

---

## Anti-Patterns

**The Vague Checklist**: "Check for security issues" is not a checklist item.
"Check for: SQL injection via string concatenation in queries, XSS via unescaped
user input in templates, CSRF on state-changing POST endpoints" is a checklist.

**The Format-Only Skill**: Beautiful output template but no methodology for generating
the content. A skill must tell you HOW to find issues, not just how to format them.

**The Linter Trap**: A skill that just runs existing tools and reports output. Skills
should go BEYOND tools — logic errors, design issues, architectural problems.

**The Unbounded Skill**: No scope, no prioritization, tries to check everything equally.
Good skills have tiers so they scale with available time.

**Skipping Domain Research**: The 5 minutes researching what experts check produces
skills 10x better than those built from vibes.
