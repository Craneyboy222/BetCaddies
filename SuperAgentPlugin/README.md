# AI Super Agent Plugin

The supreme meta-agent orchestrator for Claude Code. Transforms every task into ceiling-quality output through dynamic pipeline scaling.

## What It Does

This plugin is the agent's operating system — a layer between the user's request and the agent's execution that ensures every output is the absolute best possible.

- **Simple tasks** (reverse a string, explain X): Fast single-pass with quality calibration
- **Medium tasks** (build an API, debug a component): Self-prompting + methodology + role forging
- **Complex tasks** (build a full app, audit a repo): Full 8-phase pipeline with path simulation, cost optimization, multi-agent orchestration, model routing
- **Meta tasks** (create a skill, configure the agent): Specialized self-improvement handler

## Installation

```
claude plugin add ./SuperAgentPlugin
```

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

```
Phase 0: Intake & Classify (always)
Phase 1: Optimize Thinking / Self-Prompt
Phase 2: Build Methodology / Skill Synthesis
Phase 3: Forge Execution Identity
Phase 4: Simulate Paths (synth-plan)
Phase 5: Optimize Cost
Phase 6: Orchestrate Agents
Phase 7: Route Models
Phase 8: Execute & Deliver (always)
```

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
