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
