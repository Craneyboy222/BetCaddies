# Adaptive Execution Patterns

A self-improvement framework for the AI Super Agent. This reference tracks what
works, what doesn't, and how to continuously improve pipeline execution quality.

---

## Table of Contents

1. [Execution Pattern Library](#execution-pattern-library)
2. [Performance Signals](#performance-signals)
3. [Optimization Heuristics](#optimization-heuristics)
4. [Self-Diagnostic Protocol](#self-diagnostic-protocol)
5. [Evolution Strategies](#evolution-strategies)

---

## Execution Pattern Library

### Patterns That Consistently Produce Ceiling Output

**1. Specificity Cascade**
The more specific the self-prompt, the better the output. Every level of specificity
compounds: specific role + specific experience + specific quality markers produces
dramatically better output than any one alone.
- **Signal it's working**: Output feels "uncannily appropriate" for the task
- **Signal it's failing**: Output is generic despite detailed instructions
- **Fix**: Add another layer of specificity to the weakest dimension

**2. Failure Mode Pre-Loading**
Explicitly stating what mediocre output looks like BEFORE generating output prevents
most common quality failures. The brain avoids what it can see clearly.
- **Signal it's working**: Output avoids all listed failure modes
- **Signal it's failing**: Output falls into unlisted failure modes
- **Fix**: Expand the failure mode list based on actual failures observed

**3. Progressive Disclosure in References**
Loading references on-demand (only when the phase activates) outperforms preloading
all references. Targeted context produces targeted output.
- **Signal it's working**: Each phase uses its reference material directly
- **Signal it's failing**: References are loaded but not visibly influencing output
- **Fix**: Make reference content more actionable and less theoretical

**4. Adversarial Critique Pass**
A single adversarial pass ("argue this is wrong") catches more issues than 3 editorial
passes ("what could be better"). Adversarial thinking activates different evaluation
circuits than editorial thinking.
- **Signal it's working**: Adversarial pass finds substantive issues
- **Signal it's failing**: Adversarial pass only finds cosmetic issues (convergence)
- **Fix**: If consistently finding nothing, the initial generation has improved enough
  to reduce adversarial passes

**5. Decomposition Before Generation**
For any output >200 lines, decomposing into sections with per-section quality criteria
produces better results than generating monolithically. Each section gets focused
attention.
- **Signal it's working**: Each section is independently high-quality
- **Signal it's failing**: Sections are inconsistent in quality
- **Fix**: Add transition quality checks between sections

---

## Performance Signals

### Positive Signals (pipeline is working)
- User accepts output without revision requests
- Output addresses both stated and unstated needs
- Code runs correctly on first try
- User says "that's exactly what I wanted" or similar
- No follow-up questions about missing aspects
- Output quality is consistent across different task types

### Negative Signals (pipeline needs adjustment)
- User frequently asks for revisions
- Output misses requirements that were stated
- Code has bugs that should have been caught
- User has to re-explain requirements
- Output is too verbose or too sparse for the context
- Quality varies significantly between similar tasks

### Diagnostic Questions
When negative signals appear, ask:
1. **Was the classification correct?** — Did Phase 0 choose the right complexity tier?
2. **Was the self-prompt specific enough?** — Did Phase 1 capture the real quality need?
3. **Was the methodology appropriate?** — Did Phase 2 cover the right dimensions?
4. **Was the role well-matched?** — Did Phase 3 activate the right expertise?
5. **Was the path simulation accurate?** — Did Phase 4 anticipate real issues?
6. **Did the critique loop catch what matters?** — Did Phase 8 find the actual weaknesses?

---

## Optimization Heuristics

### Task Type Optimization

**Code Generation**
- Most impactful phase: Phase 1 (self-prompt) — role specificity matters enormously
- Least impactful phase: Phase 5 (cost) — code quality variance far exceeds cost variance
- Key optimization: Test-driven thinking (define tests mentally before writing code)
- Common failure: Generic role framing ("senior engineer" instead of specific expert)

**Writing Tasks**
- Most impactful phase: Phase 3 (forge) — audience persona and voice calibration
- Least impactful phase: Phase 4 (simulate) — writing rarely needs path simulation
- Key optimization: One-sentence core (define THE takeaway before writing)
- Common failure: Not calibrating formality to audience

**Analysis Tasks**
- Most impactful phase: Phase 2 (methodology) — systematic coverage prevents gaps
- Least impactful phase: Phase 7 (model routing) — analysis rarely parallelizes well
- Key optimization: Framework selection (pick the right analytical lens first)
- Common failure: Missing actionability — analysis without recommendations

**Architecture Tasks**
- Most impactful phase: Phase 4 (simulate) — path simulation prevents costly commits
- Least impactful phase: Phase 5 (cost) — architecture quality is the priority
- Key optimization: Stress testing against failure scenarios
- Common failure: Over-engineering for future requirements that may never materialize

**Audit Tasks**
- Most impactful phase: Phase 2 (methodology) — comprehensive checklist is everything
- Least impactful phase: Phase 1 (self-prompt) — methodology drives quality, not prompting
- Key optimization: Domain-specific checklist from frameworks.md
- Common failure: The Linter Trap (just running tools instead of reasoning about code)

### Phase Optimization

| Phase | When It Adds Most Value | When It Adds Least Value |
|-------|------------------------|-------------------------|
| Phase 1 | Novel tasks, creative work | Routine tasks with clear specs |
| Phase 2 | Systematic tasks, audits | One-off tasks, simple builds |
| Phase 3 | Tasks needing deep expertise | Tasks with obvious approach |
| Phase 4 | Multi-component systems | Single-file changes |
| Phase 5 | Large builds (50K+ tokens) | Small tasks (<10K tokens) |
| Phase 6 | Independent parallel work | Sequential dependent work |
| Phase 7 | Mixed-complexity subtasks | Uniform-complexity tasks |

---

## Self-Diagnostic Protocol

### After Every COMPLEX Task
Run this diagnostic (internally, not shown to user):

1. **Classification accuracy**: Was the complexity tier correct? Would the output have
   been better with more/fewer pipeline phases?

2. **Phase value assessment**: Which phases contributed most to quality? Which could
   have been skipped without quality loss?

3. **Critique effectiveness**: Did the self-critique loop catch real issues? Or was it
   mostly cosmetic polishing?

4. **Model routing efficiency**: Were subtasks routed to appropriate models? Could any
   have used a lighter model without quality loss?

5. **Agent orchestration efficiency**: Were subagents used effectively? Was parallelism
   maximized where possible?

6. **Time allocation**: Was too much time spent on low-value phases? Could the same
   quality have been achieved faster?

### After Negative Feedback
When the user indicates the output wasn't what they wanted:

1. **Identify the gap**: What specifically was wrong or missing?
2. **Trace to phase**: Which pipeline phase should have caught this?
3. **Root cause**: Was it a classification error? Missing methodology? Wrong expertise?
   Insufficient critique?
4. **Fix forward**: What would prevent this class of issue in the future?

---

## Evolution Strategies

### Strategy 1: Phase Tuning
Over time, adjust which phases activate for which task types based on observed
value-add. If Phase 2 (methodology) consistently doesn't improve writing tasks,
skip it for writing. If Phase 4 (simulate) catches critical issues in API design,
always run it for APIs.

### Strategy 2: Reference Enhancement
When a reference file consistently proves useful, expand it. When a reference file
is loaded but never influences the output, either make it more actionable or remove
it from the loading schedule.

### Strategy 3: Failure Mode Accumulation
Maintain a growing list of observed failure modes by task type. Each failure mode
encountered gets added to Phase 1's failure mode pre-loading for that task type.
Over time, the self-prompt becomes increasingly tailored to avoid real failures.

### Strategy 4: Quality Baseline Raising
As the pipeline matures, what was once "ceiling" becomes "baseline." Periodically
reassess the quality gradient in Phase 3 to raise the floor, target, and ceiling.
What was exceptional last month should be standard this month.

### Strategy 5: Skill Library Growth
Every META task that generates a new skill adds to the agent's capability library.
Track which skills are reused most and invest in improving those. Skills that are
never reused can be archived.

### Strategy 6: Pipeline Compression
As patterns become internalized, compress the pipeline. Phases that were once explicit
become automatic. The goal is not to run all phases on every task forever — it's to
internalize the quality patterns so deeply that the pipeline can scale down without
quality loss.

---

## Anti-Patterns in Self-Improvement

**The Complexity Trap**: Adding more phases, more checks, more references because "more
is better." The optimal pipeline is the SIMPLEST one that consistently produces ceiling
output. Remove phases that don't add value.

**The Perfection Trap**: Spending time optimizing the pipeline instead of doing the task.
The pipeline is a means, not an end. If the user asked for a function, they want a
function — not a perfect pipeline that produces a function.

**The Rigidity Trap**: Following the pipeline mechanically even when it clearly doesn't
fit the current task. The pipeline is a framework, not a cage. Skip phases that don't
apply. Add phases that the current task needs.

**The Meta-Meta Trap**: Optimizing the optimization of the optimization. One level of
self-improvement is valuable. Two levels are occasionally useful. Three or more levels
are always waste.
