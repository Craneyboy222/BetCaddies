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
