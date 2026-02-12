# Prompt Patterns Library

A curated catalog of proven prompting patterns for self-prompt synthesis. These are building
blocks — combine, adapt, and extend them based on task needs. Never use a pattern verbatim;
always synthesize for the specific task.

---

## Table of Contents

1. [Reasoning Patterns](#reasoning-patterns)
2. [Role & Expertise Patterns](#role--expertise-patterns)
3. [Structure Patterns](#structure-patterns)
4. [Quality Assurance Patterns](#quality-assurance-patterns)
5. [Code-Specific Patterns](#code-specific-patterns)
6. [Writing-Specific Patterns](#writing-specific-patterns)
7. [Analysis Patterns](#analysis-patterns)
8. [Meta-Cognitive Patterns](#meta-cognitive-patterns)
9. [Synthesis Patterns](#synthesis-patterns)

---

## Reasoning Patterns

### Chain-of-Thought (CoT)
**When**: Any task requiring multi-step reasoning, math, logic, or causal analysis.
**How**: Instruct yourself to show intermediate reasoning steps before reaching conclusions.
**Self-prompt fragment**: "Think through this step-by-step. For each step, state what you
know, what you're inferring, and why before moving to the next step."
**Strength**: Dramatically improves accuracy on complex reasoning tasks.
**Pitfall**: Can be verbose for simple tasks. Skip for single-step answers.

### Tree-of-Thought (ToT)
**When**: Problems with multiple viable approaches where the best path isn't obvious.
**How**: Generate 2-3 candidate approaches, evaluate each briefly, then pursue the most
promising one in depth.
**Self-prompt fragment**: "Generate three distinct approaches to this problem. For each,
identify the key trade-off. Select the approach that best satisfies [primary constraint]
and execute it fully."
**Strength**: Avoids commitment to the first approach that comes to mind.
**Pitfall**: Overhead is wasted on problems with one obvious good approach.

### Hypothesis-Elimination
**When**: Debugging, diagnostic reasoning, root cause analysis.
**How**: Generate multiple hypotheses, rank by likelihood, then systematically test/eliminate.
**Self-prompt fragment**: "Before investigating, form 3-5 hypotheses ranked by probability.
For each, identify one observation that would confirm or rule it out. Work from most likely
to least likely."
**Strength**: Prevents fixation on the first plausible explanation.

### First Principles
**When**: Novel problems, paradigm-breaking design, or when conventional solutions are
clearly insufficient.
**How**: Strip the problem to its fundamental truths and build up from there, ignoring
convention.
**Self-prompt fragment**: "Ignore how this is typically done. What are the irreducible
requirements? What are the physical/logical constraints? Build a solution from these
foundations."
**Strength**: Produces genuinely novel solutions.
**Pitfall**: Slow. Don't use when conventional solutions are adequate.

### Analogical Reasoning
**When**: Unfamiliar domains, creative problem-solving, explaining complex concepts.
**How**: Find a well-understood domain with structural similarity and map insights across.
**Self-prompt fragment**: "What well-understood system shares the same structural dynamics
as this problem? Map the analogy explicitly, noting where it holds and where it breaks down."

---

## Role & Expertise Patterns

### Expert Role Assignment
**When**: Any task that benefits from domain expertise framing.
**How**: Assign yourself a specific expert identity with relevant credentials and
perspective. Be specific — not "an expert" but "a senior distributed systems engineer
who has debugged consensus failures at scale."
**Self-prompt fragment**: "You are [specific expert with specific experience]. Approach
this with the priorities, instincts, and standards that role implies."
**Strength**: Activates domain-appropriate reasoning patterns and quality standards.
**Pitfall**: Don't stack multiple conflicting expert roles.

### Multi-Expert Panel
**When**: Problems requiring multiple disciplinary perspectives (architecture decisions,
product strategy, trade-off analysis).
**How**: Simulate 2-3 expert perspectives, let them "disagree" constructively, then
synthesize.
**Self-prompt fragment**: "Consider this from three angles: [Expert A: optimization],
[Expert B: maintainability], [Expert C: user experience]. Where do they agree? Where do
they conflict? What's the best synthesis?"
**Strength**: Catches blind spots that a single-perspective approach misses.

### Audience Persona
**When**: Any communication-oriented task (writing, documentation, teaching).
**How**: Model the recipient's knowledge level, goals, and context.
**Self-prompt fragment**: "The reader is [specific persona]. They already know [X] but
not [Y]. They're reading this because they need to [goal]. Every sentence should serve
that need."

---

## Structure Patterns

### Specification-First
**When**: Code generation, API design, system design.
**How**: Define the interface/contract/spec before any implementation.
**Self-prompt fragment**: "Before writing any code, define: inputs (with types and
constraints), outputs (with guarantees), error cases, and invariants. Only then
implement."
**Strength**: Prevents implementation-driven design.

### Outline-Then-Execute
**When**: Long-form writing, multi-section documents, complex analysis.
**How**: Create a complete structural outline first, then fill each section.
**Self-prompt fragment**: "First, create a complete outline with section purposes.
Each section should have a single clear job. Then write each section, ensuring it
fulfills its job and transitions cleanly to the next."

### Progressive Disclosure
**When**: Explanations, documentation, tutorials.
**How**: Lead with the most important/actionable information, then layer depth.
**Self-prompt fragment**: "Structure as: (1) the answer they need immediately,
(2) the context that helps them understand why, (3) the edge cases and nuance.
A reader who stops at any level should have gotten value."

### Decomposition
**When**: Complex multi-step tasks that benefit from divide-and-conquer.
**How**: Break the task into independently solvable sub-tasks, solve each, then
synthesize.
**Self-prompt fragment**: "Decompose into N sub-tasks where each can be evaluated
independently. For each: define success criteria, solve it, verify it meets criteria.
Then synthesize into a coherent whole, checking that sub-task solutions don't conflict."

---

## Quality Assurance Patterns

### Pre-Mortem
**When**: Before delivering any significant output.
**How**: Imagine the output has failed — what went wrong?
**Self-prompt fragment**: "Before finalizing, imagine the user found this output
disappointing. What specifically would they complain about? Address those issues."
**Strength**: Catches the most likely failure modes.

### Red Team
**When**: Code that needs to be robust, arguments that need to be airtight, designs
that need to handle adversarial conditions.
**How**: Actively try to break your own output.
**Self-prompt fragment**: "Now try to break this. What inputs would cause it to fail?
What counterarguments could dismantle this reasoning? What edge cases weren't handled?
Fix everything you find."

### Constraint Verification
**When**: Any task with explicit or implicit constraints.
**How**: Enumerate all constraints and verify each is satisfied.
**Self-prompt fragment**: "List every constraint (stated and implied). For each,
verify the output satisfies it. If any constraint is violated, fix it before delivering."

### Test-Driven Thinking
**When**: Code generation, especially functions and APIs.
**How**: Think about what tests would validate correctness BEFORE implementing.
**Self-prompt fragment**: "Before implementation, define 5 test cases: 2 happy path,
2 edge cases, 1 error case. Write code that would pass all of them."

---

## Code-Specific Patterns

### API Surface First
**When**: Building libraries, modules, services, or any code with consumers.
**How**: Design the public interface before the internals.
**Self-prompt fragment**: "Design the API a user would WANT to use. What's the simplest
correct call site? Work backward from that to the implementation."

### Defensive Implementation
**When**: Production code, anything handling external input.
**How**: Assume inputs are adversarial or malformed.
**Self-prompt fragment**: "For every function entry point: validate inputs, handle nulls,
constrain ranges, and provide clear error messages. Fail fast and loudly."

### Root Cause Analysis
**When**: Debugging.
**How**: Don't fix symptoms. Trace the causal chain to the origin.
**Self-prompt fragment**: "The bug you see is the symptom, not the cause. Ask 'why?'
at least 3 times. The fix should address the deepest 'why' that's within scope."

---

## Writing-Specific Patterns

### Voice Calibration
**When**: Any writing task where tone matters.
**How**: Define voice parameters explicitly.
**Self-prompt fragment**: "Voice parameters: formality=[1-10], confidence=[1-10],
warmth=[1-10], technicality=[1-10]. Calibrate to [context] and maintain consistency."

### One-Sentence Core
**When**: Any writing that needs focus.
**How**: Define the single most important sentence the piece must convey.
**Self-prompt fragment**: "If the reader remembers only one sentence, it should be:
[___]. Every other sentence in this piece exists to make that one sentence land harder."

### Show Don't Tell
**When**: Creative writing, case studies, persuasive content.
**How**: Use concrete specifics instead of abstract claims.
**Self-prompt fragment**: "Replace every abstract claim with a concrete example,
number, or scenario. 'Our system is fast' becomes 'p99 latency under 12ms.'"

---

## Analysis Patterns

### Framework Selection
**When**: Strategic analysis, decision-making, evaluation tasks.
**How**: Choose the right analytical framework before analyzing.
**Self-prompt fragment**: "Before analyzing, select the most appropriate framework(s):
SWOT, Porter's Five Forces, Jobs-to-be-Done, Cost-Benefit, Risk Matrix, etc.
Justify why this framework fits this specific situation."

### Multi-Lens Analysis
**When**: Complex situations requiring multiple perspectives.
**How**: Analyze the same situation through 3+ distinct lenses.
**Self-prompt fragment**: "Analyze through: (1) economic lens, (2) human/stakeholder
lens, (3) systems/technical lens. Note where the lenses agree (high confidence) and
where they conflict (key tensions to resolve)."

### Evidence Grounding
**When**: Any analysis making claims or recommendations.
**How**: Every claim must be traceable to evidence or explicit reasoning.
**Self-prompt fragment**: "For every claim: what evidence supports it? What evidence
would disprove it? If you can't answer both, the claim isn't ready."

---

## Meta-Cognitive Patterns

### Confidence Calibration
**When**: Any task where the user needs to know what's certain vs. uncertain.
**How**: Explicitly rate your confidence in different parts of the output.
**Self-prompt fragment**: "For each major claim or recommendation, internally rate
confidence: HIGH (I'd bet on this), MEDIUM (best available answer but could be wrong),
LOW (this is a guess). Flag anything LOW to the user."

### Assumption Surfacing
**When**: Any task where you're making choices the user didn't specify.
**How**: Make implicit assumptions explicit.
**Self-prompt fragment**: "What am I assuming that the user didn't say? List every
assumption. For each, ask: is this the most reasonable default? Would the user be
surprised by this choice?"

### Scope Management
**When**: Requests that are vague, overly broad, or could spiral.
**How**: Define clear boundaries for what you will and won't address.
**Self-prompt fragment**: "Explicitly scope: IN = [what I'll address], OUT = [what
I won't, and why]. If the user's request is ambiguous, pick the most useful
interpretation and state the assumption."

---

## Synthesis Patterns

### Pattern Combination Rules

When combining patterns, follow these principles:

1. **Max 3 primary patterns per task** — More creates confusion, not quality
2. **Patterns must be compatible** — Don't combine "First Principles" (ignore convention)
   with "Idiomatic" (follow convention) unless you've resolved the tension
3. **One reasoning pattern + one structure pattern + one QA pattern** is the typical combo
4. **Novel synthesis > template stacking** — Use patterns as inspiration, not scripts

### Combination Examples

**"Build a user authentication system"**
→ Expert Role (security engineer) + Specification-First + Defensive Implementation + Red Team

**"Write a blog post about climate tech"**
→ Audience Persona + One-Sentence Core + Progressive Disclosure + Pre-Mortem

**"Debug this memory leak"**
→ Hypothesis-Elimination + Root Cause Analysis + Constraint Verification

**"Design a real-time notification system"**
→ Multi-Expert Panel + Constraint Mapping + Trade-off Matrix + Decomposition
