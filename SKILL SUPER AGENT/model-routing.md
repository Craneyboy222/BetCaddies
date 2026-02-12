# Model Routing Intelligence

Comprehensive guide for selecting the optimal AI model for each subtask.
Model routing applies ONLY to subagent delegation via the Task tool — the primary
conversation always stays on the current model.

---

## Table of Contents

1. [Model Capabilities Profile](#model-capabilities-profile)
2. [Task-to-Model Mapping](#task-to-model-mapping)
3. [Cost-Performance Analysis](#cost-performance-analysis)
4. [Routing Decision Tree](#routing-decision-tree)
5. [Override Rules](#override-rules)

---

## Model Capabilities Profile

### Claude Opus 4.6 / 4.5
**Strengths**: Deep multi-step reasoning, novel problem solving, nuanced interpretation,
meta-cognitive tasks, complex architecture, creative writing, ambiguous requirements.
**Best for**: Tasks where a wrong answer is expensive, tasks requiring synthesis across
multiple domains, tasks requiring judgment under uncertainty.
**Cost**: $5.00 / $25.00 per 1M tokens (input/output)
**When to use**: When reasoning depth directly determines output quality.

### Claude Sonnet 4.5
**Strengths**: Strong code generation, balanced reasoning, good at following established
patterns, fast execution, reliable for well-defined tasks.
**Best for**: Standard code generation, documentation, test writing, refactoring,
data transformation, template-based output.
**Cost**: $3.00 / $15.00 per 1M tokens (input/output) — 40% cheaper than Opus
**When to use**: When the task follows known patterns and speed/cost matters.

### Claude Haiku 4.5
**Strengths**: Extremely fast, very low cost, good at simple extraction, classification,
formatting, file scanning, basic search and retrieval.
**Best for**: File exploration, grep-like tasks, simple transformations, codebase
scanning, metadata extraction, formatting conversions.
**Cost**: $1.00 / $5.00 per 1M tokens (input/output) — 80% cheaper than Opus
**When to use**: When the task is mechanical, well-defined, and speed matters.

---

## Task-to-Model Mapping

### Haiku Tasks (mechanical, speed-critical)

| Task | Why Haiku |
|------|-----------|
| File search and pattern matching | Mechanical, no reasoning needed |
| Codebase scanning for patterns | Exploration, not analysis |
| Simple format conversion | Deterministic transformation |
| Metadata extraction | Structured extraction |
| Log parsing | Pattern recognition |
| Simple grep/find operations | Search, not reasoning |
| Running build/test commands | Command execution |
| Basic file reading and summarization | Extraction, not synthesis |

### Sonnet Tasks (balanced quality and speed)

| Task | Why Sonnet |
|------|-----------|
| Standard code generation | Follows patterns well, fast |
| Test writing | Pattern-based, high volume |
| Documentation generation | Structured, template-driven |
| Refactoring (well-defined) | Follows rules, applies patterns |
| CRUD API generation | Established patterns |
| Component scaffolding | Template-based |
| Data transformation scripts | Well-defined input/output |
| Bug fixes (clear root cause) | Apply known fix patterns |
| CI/CD configuration | Convention-based |
| Linting and formatting | Rule-following |

### Opus Tasks (deep reasoning required)

| Task | Why Opus |
|------|----------|
| Complex architecture design | Multi-factor trade-off analysis |
| Novel algorithm creation | Creative problem-solving |
| Security-critical code | Zero tolerance for errors |
| Ambiguous requirement interpretation | Nuanced judgment |
| Root cause analysis (unclear bugs) | Hypothesis generation and testing |
| Performance optimization strategy | Systemic analysis |
| API surface design | Consumer-first creative thinking |
| Code audit findings synthesis | Pattern recognition across findings |
| Technical RFC writing | Persuasion + accuracy + foresight |
| Self-improvement and meta-tasks | Meta-cognitive reasoning |
| Financial/payment processing logic | Correctness is non-negotiable |

---

## Cost-Performance Analysis

### Cost per Typical Task

| Task | Haiku Cost | Sonnet Cost | Opus Cost | Recommended |
|------|-----------|-------------|-----------|-------------|
| Scan 50 files for pattern | $0.02 | $0.06 | $0.10 | Haiku |
| Generate 200-line module | $0.08 | $0.24 | $0.40 | Sonnet |
| Write 50 unit tests | $0.10 | $0.30 | $0.50 | Sonnet |
| Design system architecture | $0.04 | $0.12 | $0.20 | Opus |
| Debug complex race condition | $0.03 | $0.09 | $0.15 | Opus |
| Generate full API docs | $0.06 | $0.18 | $0.30 | Sonnet |

### Savings from Intelligent Routing

For a typical COMPLEX task (full app build):
- All-Opus execution: ~$6.75
- Intelligently routed: ~$4.50 (Haiku for search, Sonnet for gen, Opus for design)
- Savings: ~33% with ZERO quality reduction

The key insight: Opus quality is wasted on mechanical tasks. Haiku quality is
insufficient for reasoning tasks. Matching model to task is free quality.

---

## Routing Decision Tree

```
Is the task mechanical (search, scan, format, extract)?
  YES -> Haiku
  NO  -> Does the task follow a well-established pattern?
           YES -> Is correctness critical (security, financial, data integrity)?
                    YES -> Opus
                    NO  -> Sonnet
           NO  -> Does the task require creative problem-solving or judgment?
                    YES -> Opus
                    NO  -> Does the task require synthesis across domains?
                             YES -> Opus
                             NO  -> Sonnet
```

### Quick Reference
- **If you can write the exact instructions** -> Haiku or Sonnet
- **If you need the agent to figure it out** -> Opus
- **If an error would be expensive** -> Opus
- **If speed matters more than depth** -> Haiku
- **When in doubt** -> Sonnet (safe middle ground)

---

## Override Rules

1. **User explicit request always wins** — "use haiku" means use haiku
2. **Security tasks never route below Opus** — non-negotiable
3. **Financial/payment tasks never route below Opus** — non-negotiable
4. **If a Sonnet subagent produces questionable output, re-run on Opus** — quality gate
5. **META tasks always use Opus** — self-improvement requires deepest reasoning
6. **Batch routing for similar tasks** — if spawning 10 agents for similar work,
   route them all to the same model for consistency
7. **Verification always uses same or higher model** — never verify Opus work with Haiku
