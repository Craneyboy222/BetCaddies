# Multi-Agent Orchestration Strategy

Comprehensive guide for spawning, coordinating, and verifying subagent work.
Subagents are AI model instances launched via the Task tool that work in parallel
on independent subtasks.

---

## Table of Contents

1. [When to Orchestrate](#when-to-orchestrate)
2. [Agent Types and Capabilities](#agent-types-and-capabilities)
3. [Spawning Patterns](#spawning-patterns)
4. [Coordination Strategies](#coordination-strategies)
5. [Verification Protocol](#verification-protocol)
6. [Anti-Patterns](#anti-patterns)

---

## When to Orchestrate

### Spawn Subagents When
- **Independent parallel work exists** — 2+ tasks with no dependencies between them
- **Research + build** — exploration/research can happen while you plan/build
- **Verification needed** — a separate agent can QA while you continue
- **Codebase exploration** — scanning large codebases for patterns, files, or context
- **Batch operations** — similar operations across multiple files or directories
- **Time-critical tasks** — parallelism reduces total wall-clock time

### Do NOT Spawn When
- **Task is sequential** — each step depends on the previous step's output
- **Task is trivial** — agent startup overhead (~5s) exceeds task duration
- **Single file operation** — just do it directly
- **Context is critical** — the subagent would need your full conversation context
- **Coordination overhead > parallelism benefit** — usually for <3 independent tasks

### Cost-Benefit Quick Check
```
Agent overhead:  ~5 seconds startup + ~500 tokens tool overhead
Break-even:      Task must take >10 seconds and >1000 tokens to justify spawning
Sweet spot:      3-10 independent tasks of moderate complexity
```

---

## Agent Types and Capabilities

### Explore Agent
**Purpose**: Fast codebase exploration, file finding, pattern searching
**Model**: Haiku (speed-optimized)
**Tools**: Glob, Grep, Read (no Edit/Write)
**Best for**: "Find all files matching X", "Search for pattern Y", "What does Z look like?"
**Prompt template**:
```
Search the codebase for [specific pattern/file/structure].
Report: file paths, line numbers, and a brief summary of what you found.
Thoroughness level: [quick/medium/very thorough]
```

### Bash Agent
**Purpose**: Command execution — build, test, lint, install
**Model**: Haiku or Sonnet (depends on interpretation needed)
**Tools**: Bash only
**Best for**: "Run tests", "Install dependencies", "Build the project", "Check git status"
**Prompt template**:
```
Execute the following commands and report the results:
[commands]
If any command fails, report the error and suggest a fix.
```

### General-Purpose Agent
**Purpose**: Complex multi-step tasks requiring reasoning and tool use
**Model**: Sonnet (standard) or Opus (complex)
**Tools**: All tools
**Best for**: Code generation, research, analysis, multi-step workflows
**Prompt template**:
```
Task: [detailed description with all necessary context]
Context: [everything the agent needs to know — it has NO conversation history]
Expected output: [what to return]
Quality criteria: [what good looks like]
```

### Plan Agent
**Purpose**: Architecture design and implementation planning
**Model**: Opus (reasoning-critical)
**Tools**: All tools except Edit/Write
**Best for**: "Design the architecture for X", "Plan the implementation of Y"
**Prompt template**:
```
Design an implementation plan for [system/feature].
Requirements: [list]
Constraints: [list]
Evaluate trade-offs and recommend the optimal approach with reasoning.
```

---

## Spawning Patterns

### Pattern 1: Parallel Research
Spawn multiple Explore agents to scan different parts of a codebase simultaneously.
```
Agent 1 (Haiku): Search src/ for authentication patterns
Agent 2 (Haiku): Search tests/ for existing test coverage
Agent 3 (Haiku): Search config/ for environment configuration
```
**When**: Starting a new task on an unfamiliar codebase
**Benefit**: 3x faster reconnaissance

### Pattern 2: Research While Building
Spawn a research agent while you work on the main task.
```
Main thread: Writing the implementation based on current knowledge
Agent 1 (Haiku): Searching for related patterns in the codebase
Agent 2 (Sonnet): Generating test cases for the implementation
```
**When**: You have enough context to start but need more for completeness
**Benefit**: No idle time waiting for research

### Pattern 3: Parallel Generation
Spawn multiple General agents to generate independent components.
```
Agent 1 (Sonnet): Generate the data models and schemas
Agent 2 (Sonnet): Generate the API route handlers
Agent 3 (Sonnet): Generate the test suite
```
**When**: Components are truly independent and well-specified
**Benefit**: 3x faster generation
**Risk**: Style inconsistency — mitigate by providing style guide in each prompt

### Pattern 4: Build + Verify
Spawn a verification agent after completing a piece of work.
```
Main thread: Continues to next component
Agent 1 (Sonnet): Reviews the just-completed component for bugs
Agent 2 (Haiku): Runs the test suite against the new code
```
**When**: Quality assurance is important but shouldn't block progress
**Benefit**: Continuous QA without stopping to verify

### Pattern 5: Fan-Out/Fan-In
Spawn multiple agents for the same task with different approaches, then select best.
```
Agent 1 (Opus): Implement using approach A
Agent 2 (Opus): Implement using approach B
Main thread: Compare outputs, select and refine the best
```
**When**: High-stakes tasks where the optimal approach is unclear
**Benefit**: Explores solution space in parallel
**Cost**: 2x resource usage — use only when the quality difference justifies it

---

## Coordination Strategies

### Context Passing
Subagents start with NO conversation history. You must provide ALL necessary context:
- **File paths** — exact paths to read
- **Requirements** — what to build/find/analyze
- **Conventions** — coding style, naming patterns, project structure
- **Dependencies** — what this component interfaces with
- **Quality criteria** — what good output looks like

### Result Integration
When subagent results return:
1. **Read all results before acting** — don't integrate piecemeal
2. **Check for conflicts** — did agents make contradictory decisions?
3. **Resolve style differences** — normalize naming, formatting, patterns
4. **Verify interfaces** — do components that will interact actually fit together?
5. **Run integration checks** — build/lint/test the combined output

### Dependency Management
For tasks with partial dependencies:
```
Phase 1: Spawn independent tasks (all parallel)
Phase 2: Wait for Phase 1 results
Phase 3: Spawn dependent tasks using Phase 1 outputs (parallel where possible)
Phase 4: Integrate all results
```
Never spawn a task that depends on another task's output — wait for the dependency.

---

## Verification Protocol

### Always Verify
- Code generated by subagents (syntax, logic, imports)
- File paths referenced by subagents (do they exist?)
- Integration points between components from different agents
- Style consistency across agent outputs

### Verification Methods

| Method | When | How |
|--------|------|-----|
| Build test | After code generation | Run build/compile |
| Lint check | After code generation | Run project linter |
| Manual review | Complex logic | Read and reason about output |
| Cross-agent check | Multi-agent output | Compare interfaces between components |
| Smoke test | After integration | Run basic functionality test |

### Escalation
If a subagent's output fails verification:
1. If the issue is minor (syntax, formatting) — fix it directly
2. If the issue is moderate (logic error, missing case) — fix it with context from the agent
3. If the issue is fundamental (wrong approach, misunderstood requirements) — re-run
   the agent with corrected instructions, or handle the task yourself

---

## Anti-Patterns

**Over-Orchestration**: Spawning agents for tasks that would be faster done directly.
A 3-line file edit doesn't need an agent.

**Under-Specified Prompts**: "Write some tests" produces garbage. "Write unit tests
for the UserService class covering: creation with valid data, creation with duplicate
email, deletion of existing user, deletion of non-existent user. Use Jest. Follow the
pattern in tests/services/OrderService.test.ts" produces quality.

**Ignoring Verification**: Assuming subagent output is correct. Always verify,
especially code from lower-capability models.

**Sequential When Parallel is Possible**: Waiting for Agent 1 to finish before
spawning Agent 2, when both tasks are independent.

**Parallel When Sequential is Required**: Spawning agents for dependent tasks.
The second agent will lack the first agent's output and produce wrong results.

**Context Starvation**: Forgetting that subagents have no conversation history.
Every prompt must be self-contained with full context.
