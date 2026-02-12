# Token Pricing Reference

Current as of February 2026. Verify at https://claude.com/pricing for latest rates.

---

## API Pricing (per million tokens)

| Model | Input | Output | Cache Write | Cache Read |
|-------|-------|--------|-------------|------------|
| **Opus 4.6** | $5.00 | $25.00 | 1.25x input | $0.50 (90% off) |
| **Opus 4.5** | $5.00 | $25.00 | 1.25x input | $0.50 (90% off) |
| **Sonnet 4.5** | $3.00 | $15.00 | 1.25x input | $0.30 (90% off) |
| **Haiku 4.5** | $1.00 | $5.00 | 1.25x input | $0.10 (90% off) |

### Cost Modifiers

| Modifier | Effect |
|----------|--------|
| Batch API | 50% discount on input AND output |
| Prompt caching (5-min TTL) | Cache write: 1.25x input. Cache read: 0.1x input |
| Prompt caching (1-hr TTL) | Cache write: 2x input. Cache read: 0.1x input |
| Long context (>200K input) | Premium rates apply (see docs) |
| Extended thinking | Thinking tokens billed as output tokens |
| Web search | $10 per 1,000 searches + token costs |
| Tool use overhead | ~200-500 additional input tokens per tool call |

---

## Quick Cost Estimator

### By Task Size (Opus 4.6 pricing)

| Task Size | Input Est. | Output Est. | Est. Cost |
|-----------|-----------|-------------|-----------|
| Small function (50 lines) | ~5K | ~3K | ~$0.10 |
| Module (200 lines) | ~10K | ~10K | ~$0.30 |
| Small app (500 lines) | ~20K | ~25K | ~$0.73 |
| Medium app (2000 lines) | ~50K | ~100K | ~$2.75 |
| Large app (5000 lines) | ~100K | ~250K | ~$6.75 |
| Enterprise app (10K+ lines) | ~200K | ~500K | ~$13.50 |
| Full system build (20K+ lines) | ~400K | ~1M | ~$27.00 |

**Note:** These are rough estimates. Actual costs depend heavily on:
- How much context needs to be read (existing codebase size)
- Number of multi-turn exchanges (context accumulates)
- Critique/revision iterations (each pass costs ~30% of initial)
- Tool calls and web searches
- File creation overhead

### By Component Type (output tokens only)

| Component | Tokens per Unit | Unit |
|-----------|----------------|------|
| Python/JS/TS code | ~40 | per line |
| Java/C#/Go code | ~50 | per line |
| HTML/CSS | ~35 | per line |
| JSON/YAML config | ~35 | per line |
| Markdown docs | ~30 | per line |
| SQL schemas + queries | ~40 | per line |
| Test files | ~45 | per line |
| Comments (inline) | ~15 | per comment |

### Context Overhead Multipliers

| Factor | Multiplier |
|--------|-----------|
| Self-prompt optimization | 1.1x (adds ~10% thinking overhead) |
| Skill-gen methodology | 1.05x (minor planning overhead) |
| Prompt-forge role crafting | 1.05x (minor framing overhead) |
| Synth-plan simulation | 1.3-1.5x (significant but prevents costly backtracking) |
| Cost-optimizer analysis | 1.02x (minimal overhead, nets savings) |
| Self-critique loop (per pass) | 1.25-1.35x (compounds per iteration) |

### Net Savings from Optimization

Typical savings by optimization type:

| Optimization | Savings Range | Conditions |
|-------------|--------------|------------|
| Batch file operations | 15-25% of context tokens | When building multi-file systems |
| Targeted file reading | 20-40% of input tokens | When working with large codebases |
| Pattern establishment | 10-15% of output tokens | When many similar components exist |
| Pre-resolved design decisions | 30-50% of backtrack tokens | When architecture is complex |
| Grouped file generation | 10-20% of context tokens | When files share context |

**Typical net effect of the full optimization pipeline on a large task:**
- Without optimization: $X
- With pipeline overhead but optimization applied: ~0.75-0.85X
- Net savings: 15-25% on tasks >50K output tokens

The pipeline skills (self-prompt through cost-optimizer) add ~15-20% overhead in
planning tokens but typically save 30-40% in execution tokens by preventing
backtracking, redundancy, and rework. The net effect is positive for any task
above ~50K output tokens.

---

## Cost Comparison: Optimized vs. Unoptimized

### Example: Full-Stack Web App (Medium Complexity)

**Unoptimized execution:**
- Read entire codebase 3 times across phases: 150K input tokens
- Generate code with backtracking: 120K output tokens
- Regenerate after design changes: 40K output tokens
- Total: 150K input + 160K output = $4.75

**Optimized execution:**
- Read codebase once, targeted reads after: 80K input tokens
- Generate code in dependency order, no backtracking: 100K output tokens
- No regeneration (design resolved in synth-plan): 0 extra tokens
- Total: 80K input + 100K output = $2.90

**Savings: $1.85 (39%) — same output quality**
