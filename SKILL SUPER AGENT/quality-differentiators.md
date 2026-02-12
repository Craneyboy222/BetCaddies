# Quality Differentiators by Domain

What specifically separates "good" from "ceiling-grade" output in each domain. Use these
to build the Quality Gradient in Step 4 of the Forge process.

---

## Code Generation

**Good code:** Works, has tests, handles errors, is readable.
**Ceiling code:**
- API surface feels inevitable — like no other design would make sense
- Error messages teach the user what went wrong AND how to fix it
- Edge cases are handled not because they were listed but because the code
  fundamentally can't produce wrong results for valid inputs
- A new team member could understand the architecture by reading the code
  alone — comments explain WHY, not WHAT
- Tests document behavior, not implementation — they'd survive a full refactor
- Performance is optimal without being clever — no premature optimization but
  no obvious waste either
- Dependencies are minimal and justified

**The gap:** Good code solves the problem. Ceiling code solves the problem in a way that
makes the codebase better just by existing.

---

## System Architecture

**Good architecture:** Meets requirements, scales adequately, has clear component boundaries.
**Ceiling architecture:**
- A junior engineer could draw the system on a whiteboard after reading the design doc
- Every component has a single sentence justification for why it exists
- Failure modes are not just listed but have specific, tested recovery paths
- The system degrades gracefully under load — never cliff-edges
- Operational complexity is proportional to business value
- The architecture makes the wrong thing hard, not just the right thing easy
- Future requirements that are likely (not just possible) are accommodated
  without over-engineering

**The gap:** Good architecture works. Ceiling architecture is obvious in hindsight.

---

## Technical Writing

**Good writing:** Accurate, clear, complete, well-organized.
**Ceiling writing:**
- The reader feels smarter after reading it — not just informed
- Complex concepts are introduced through concrete scenarios before abstraction
- Every section answers an implicit question the reader was about to ask
- Technical depth is available on demand (progressive disclosure) without
  cluttering the main narrative
- Code examples are production-quality, not toy examples
- The writing creates a mental model the reader can use to reason about
  novel situations, not just the ones described

**The gap:** Good writing transfers information. Ceiling writing transfers understanding.

---

## Debugging / Problem Diagnosis

**Good debugging:** Finds and fixes the bug.
**Ceiling debugging:**
- Explains WHY the bug exists — what design assumption was wrong
- Identifies whether this is a one-off or a pattern that exists elsewhere
- The fix addresses the root cause, not the symptom
- Includes a test that would have caught the bug
- Suggests a structural change that would prevent this CLASS of bugs
- Explains the diagnostic process so the team learns to find similar issues

**The gap:** Good debugging fixes this bug. Ceiling debugging makes the team better at
catching the next one.

---

## API Design

**Good API:** Functional, documented, consistent.
**Ceiling API:**
- The simplest correct usage requires the least code
- Invalid usage fails at compile time or with immediate, clear errors — not
  silent corruption or mysterious runtime failures
- Naming is so precise that documentation feels redundant for common operations
- Versioning strategy means no consumer has ever been broken by an update
- Rate limiting, pagination, and error formats are so consistent that
  learning one endpoint teaches you all of them
- Authentication is integrated so seamlessly that developers don't think about it

**The gap:** Good APIs are usable with documentation. Ceiling APIs are usable without it.

---

## Audit / Review

**Good audit:** Finds issues, categorizes them, provides recommendations.
**Ceiling audit:**
- Identifies not just individual issues but PATTERNS — "you have an auth check
  problem, not just 3 missing auth checks"
- Recommendations are ordered by maximum impact for minimum effort
- Each finding includes the exact code change needed, not just a description
- Distinguishes between "must fix before production" and "fix when convenient"
- Identifies strengths explicitly — what the codebase does WELL and should keep doing
- Provides a prioritized action plan, not just a list of findings
- Includes architectural recommendations that would prevent entire categories of issues

**The gap:** Good audits find bugs. Ceiling audits change how the team builds software.

---

## Data Analysis

**Good analysis:** Accurate statistics, clear visualizations, valid conclusions.
**Ceiling analysis:**
- Leads with the one insight that changes a decision, not with methodology
- Every visualization is the optimal chart type for that specific data relationship
- Explicitly addresses what the data CANNOT tell you (limitations as first-class content)
- Recommendations are specific enough to act on Monday morning
- Distinguishes between statistical significance and practical significance
- Includes sensitivity analysis — how wrong could inputs be before conclusions change?
- Tells a story that a non-technical stakeholder would find compelling

**The gap:** Good analysis answers the question asked. Ceiling analysis answers the
question they should have asked.
