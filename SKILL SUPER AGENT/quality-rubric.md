# Quality Rubric Reference

Scoring guidelines for the self-critique loop. Use these to evaluate your output
consistently across iterations.

---

## Scoring Scale

| Score | Meaning |
|-------|---------|
| 9-10  | Exceptional — Could be published or shipped as-is by a domain expert |
| 7-8   | Strong — Minor improvements possible but output is high quality |
| 5-6   | Adequate — Gets the job done but has clear room for improvement |
| 3-4   | Weak — Significant issues that would disappoint a knowledgeable user |
| 1-2   | Failed — Fundamentally incorrect, incomplete, or misguided |

Target: Every relevant dimension should score 7+ before delivery. For complex tasks,
aim for 8+ on the primary dimensions.

---

## Dimension Scoring Guides

### Correctness (Universal)
- **10**: Every fact, claim, and logical step is verifiable and accurate
- **7**: Core content is correct; minor peripheral inaccuracies if any
- **4**: Contains errors that would mislead or cause problems
- **1**: Fundamentally wrong

### Completeness (Universal)
- **10**: Addresses every aspect of the request including edge cases and implications
- **7**: Covers the main request fully; minor secondary aspects could be expanded
- **4**: Missing significant aspects the user clearly expected
- **1**: Only superficially touches the request

### Clarity (Universal)
- **10**: Immediately understandable by the target audience on first read
- **7**: Clear with minor spots that could be tightened
- **4**: Requires re-reading or significant effort to follow
- **1**: Confusing, ambiguous, or poorly organized

### Elegance (Universal)
- **10**: The simplest solution that fully satisfies all requirements — nothing to add or remove
- **7**: Good solution, might have minor unnecessary complexity
- **4**: Over-engineered or unnecessarily convoluted
- **1**: Rube Goldberg — complex for no good reason

### Robustness (Code)
- **10**: Handles all valid inputs, all edge cases, all error conditions gracefully
- **7**: Handles common cases and likely errors; uncommon edge cases could be tighter
- **4**: Happy path works but common error cases would cause failures
- **1**: Breaks on normal inputs

### Performance (Code)
- **10**: Optimal algorithmic complexity; no wasted resources
- **7**: Good performance; minor optimizations possible but not impactful
- **4**: Noticeable inefficiency that would matter at scale
- **1**: Would not work at any meaningful scale

### Maintainability (Code)
- **10**: Any competent developer could understand and modify this immediately
- **7**: Well-structured with minor naming or organization improvements possible
- **4**: Would require significant effort to understand or safely modify
- **1**: Unmaintainable — would need to be rewritten to change

### Idiomatic (Code)
- **10**: Follows all conventions of the language/framework; uses appropriate idioms
- **7**: Generally idiomatic with minor style deviations
- **4**: Works but feels like it was written by someone unfamiliar with the ecosystem
- **1**: Anti-patterns throughout

---

## Diminishing Returns Decision Matrix

After each iteration, check:

| Signal | Action |
|--------|--------|
| All dimensions 8+ | **Deliver** — this is excellent |
| One dimension improved 2+ points | **Continue** — significant gains still happening |
| All changes < 1 point | **Deliver** — diminishing returns reached |
| Improving X degrades Y | **Deliver** best balanced version |
| 5th iteration reached | **Deliver** — hard stop to prevent overthinking |
| Primary dimension 9+ but secondary at 6 | **One more pass** on the secondary dimension |

---

## Task-Specific Weighting

Not all dimensions matter equally. Weight by task type:

### Code Generation
Primary (must be 8+): Correctness, Robustness, Idiomatic
Secondary (target 7+): Performance, Maintainability, Completeness
Tertiary: Clarity (of comments/docs), Elegance

### Code Review / Debugging
Primary: Correctness (of diagnosis), Completeness (of root cause)
Secondary: Clarity (of explanation), Actionability
Tertiary: Elegance

### Technical Writing
Primary: Correctness, Clarity, Completeness
Secondary: Structure, Actionability
Tertiary: Voice, Elegance

### Creative Writing
Primary: Voice, Persuasiveness, Structure
Secondary: Clarity, Elegance
Tertiary: Completeness (creative can be intentionally incomplete)

### Analysis / Strategy
Primary: Rigor, Actionability, Nuance
Secondary: Correctness, Completeness, Clarity
Tertiary: Elegance, Structure

### Architecture / Design
Primary: Correctness, Completeness, Robustness
Secondary: Elegance, Performance, Maintainability
Tertiary: Clarity (of documentation)
