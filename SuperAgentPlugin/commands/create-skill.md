---
name: create-skill
description: Force META mode for dynamic skill creation. Generate a new ceiling-quality skill for the specified domain.
---

Override the AI Super Agent to META mode with skill creation focus.

The agent must follow the full Skill Synthesis workflow:
1. Read `references/skill-synthesis.md` for the creation methodology
2. Read `references/domain-frameworks.md` for established frameworks in the target domain
3. Read `references/quality-standards.md` for the ceiling test

Execute the 6-step synthesis workflow:
1. **Need Assessment**: Confirm a skill is warranted (systematic coverage needed, domain methodology exists, structured output expected, repeatability value, or complexity warrants decomposition)
2. **Domain Research**: Identify authoritative frameworks, coverage dimensions, output expectations, common blind spots
3. **Skill Architecture**: Design scope, execution phases (3-7), coverage map, output spec, quality criteria
4. **Skill Generation**: Write SKILL.md (under 500 lines) + reference files (for checklists >30 items)
5. **Quality Validation**: Verify against ceiling test — expert recognition, no coverage gaps, format enforces quality, mediocrity harder than excellence
6. **Install & Execute**: Save to `.skills/skills/[name]/`, offer for reuse

The generated skill must pass the Pre-Use Validation Checklist from skill-synthesis.md before use.
