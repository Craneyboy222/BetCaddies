# Agent Configuration Management

Comprehensive guide for managing the agent's runtime configuration, environment settings,
keybindings, MCP servers, and skill installations. Use this reference when the user
asks to configure the agent, change settings, manage skills, or optimize their environment.

---

## Table of Contents

1. [Configuration File Map](#configuration-file-map)
2. [Settings Configuration](#settings-configuration)
3. [Keybindings Configuration](#keybindings-configuration)
4. [MCP Server Management](#mcp-server-management)
5. [Skill Management](#skill-management)
6. [Environment Optimization](#environment-optimization)

---

## Configuration File Map

```
~/.claude/                              <- Global agent configuration
  settings.json                         <- Global settings (permissions, preferences)
  keybindings.json                      <- Keyboard shortcuts
  claude.md                             <- Global system instructions (CLAUDE.md)

.claude/                                <- Project-level configuration (in project root)
  settings.json                         <- Project-specific settings
  claude.md                             <- Project-specific instructions (CLAUDE.md)

.skills/skills/                         <- Skill installation directory
  [skill-name]/
    SKILL.md                            <- Skill instructions
    references/                         <- Skill reference files

.mcp.json                               <- MCP server configuration (project root)
```

---

## Settings Configuration

### ~/.claude/settings.json (Global)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build)",
      "Bash(npm test)",
      "Bash(git status)",
      "Bash(git diff)",
      "Bash(git log)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(git push --force)"
    ]
  },
  "env": {
    "AGENT_MODEL": "opus",
    "NODE_ENV": "development"
  }
}
```

### Key Settings

**permissions.allow** — Pre-approved bash commands (no confirmation needed)
- Add commonly-used safe commands to reduce friction
- Use glob patterns: `Bash(npm *)` allows all npm commands
- Be specific for dangerous operations: `Bash(git push origin main)`

**permissions.deny** — Blocked commands (never executed)
- Block destructive operations: `Bash(rm -rf *)`, `Bash(git push --force)`
- Block sensitive data access: `Bash(cat ~/.ssh/*)`

**env** — Environment variables available during execution
- Set development mode, API keys (for non-sensitive keys), paths

### Configuration Best Practices
1. **Start permissive, tighten as needed** — Allow common operations, block dangerous ones
2. **Use project-level settings for project-specific permissions** — Git operations for
   a specific repo, build commands for a specific project
3. **Never store secrets in settings.json** — Use environment variables or secret managers
4. **Keep permissions lists short** — If it's getting long, use patterns

---

## Keybindings Configuration

### ~/.claude/keybindings.json

```json
[
  {
    "key": "ctrl+s",
    "command": "submit",
    "description": "Submit the current message"
  },
  {
    "key": "ctrl+shift+t",
    "command": "openTerminal",
    "description": "Open a new terminal tab"
  },
  {
    "key": "ctrl+k ctrl+c",
    "command": "clearConversation",
    "description": "Clear conversation (chord binding)"
  }
]
```

### Available Commands
- `submit` — Submit the current message
- `openTerminal` — Open terminal
- `clearConversation` — Clear current conversation
- `newConversation` — Start new conversation
- `toggleSidebar` — Toggle sidebar visibility
- `focusInput` — Focus the input field

### Chord Bindings
Two-key sequences: `"key": "ctrl+k ctrl+c"` — press ctrl+k, release, then press ctrl+c.
Useful for grouping related shortcuts under a common prefix.

### Key Syntax
- Modifiers: `ctrl`, `shift`, `alt`, `cmd` (Mac) / `meta` (Linux/Windows)
- Combine with `+`: `ctrl+shift+s`
- Letters: `a`-`z` (lowercase)
- Special: `enter`, `tab`, `escape`, `backspace`, `delete`, `space`
- Function: `f1`-`f12`
- Arrow: `up`, `down`, `left`, `right`

---

## MCP Server Management

### .mcp.json (Project Root)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

### Common MCP Servers

| Server | Purpose | Command |
|--------|---------|---------|
| filesystem | File access beyond sandbox | `@modelcontextprotocol/server-filesystem` |
| github | GitHub API access | `@modelcontextprotocol/server-github` |
| postgres | Database access | `@modelcontextprotocol/server-postgres` |
| memory | Persistent memory | `@modelcontextprotocol/server-memory` |
| puppeteer | Browser automation | `@modelcontextprotocol/server-puppeteer` |
| slack | Slack integration | `@modelcontextprotocol/server-slack` |

### MCP Configuration Best Practices
1. **Principle of least privilege** — Only grant access to directories/resources needed
2. **Use environment variables for secrets** — Never hardcode API keys in .mcp.json
3. **Test servers individually** — Verify each server works before combining
4. **Document server purpose** — Add comments or a companion README

---

## Skill Management

### Installing a Skill
```bash
# Create skill directory
mkdir -p .skills/skills/[skill-name]/references

# Copy SKILL.md and reference files
cp /path/to/skill/SKILL.md .skills/skills/[skill-name]/
cp /path/to/skill/references/* .skills/skills/[skill-name]/references/
```

### Skill Directory Structure
```
.skills/skills/[skill-name]/
  SKILL.md              <- Main skill instructions (max 500 lines)
  references/           <- Detailed reference files
    checklist-a.md      <- Detailed checklists (30+ items)
    framework-b.md      <- Domain frameworks
    patterns-c.md       <- Pattern libraries
  scripts/              <- Optional automation scripts
    analyze.py
    report.sh
```

### Skill Validation Checklist
Before installing a skill, verify:
- [ ] YAML frontmatter has `name` and `description`
- [ ] Description specifies trigger conditions
- [ ] SKILL.md is under 500 lines
- [ ] Has scope definition (in/out)
- [ ] Has numbered execution phases
- [ ] Has coverage map (summary in SKILL.md, detail in references)
- [ ] Has output format specification
- [ ] Has quality floor definition
- [ ] Reference files exist for checklists >30 items

### Skill Update Protocol
1. Read the existing SKILL.md to understand current state
2. Identify what needs to change and why
3. Edit the SKILL.md or reference files
4. Validate against the checklist above
5. Test the updated skill on a representative task

### Skill Removal
```bash
rm -rf .skills/skills/[skill-name]
```
Note: This only removes the skill files. Any configuration that references the skill
should also be updated.

---

## Environment Optimization

### System Instructions (claude.md)

**Global** (~/.claude/claude.md):
- Personal preferences that apply to ALL projects
- Default coding style, language preferences
- Communication preferences (verbosity, format)

**Project** (.claude/claude.md):
- Project-specific context (architecture, patterns, conventions)
- Technology stack details
- Team conventions and coding standards
- Deployment environment details

### System Instructions Best Practices
1. **Be specific** — "Use TypeScript with strict mode" not "use good practices"
2. **Include architecture context** — "This is a Next.js 14 app with App Router"
3. **Specify patterns** — "Error handling uses Result types, not try/catch"
4. **Keep it under 200 lines** — Longer instructions dilute attention
5. **Update regularly** — As the project evolves, update the instructions

### Performance Tuning
- **Reduce reference file sizes** — Large references consume context. Keep under 500 lines.
- **Use targeted reference loading** — Load only what the current phase needs
- **Batch operations** — Use single tool calls for multiple operations
- **Minimize conversation turns** — Each turn re-reads accumulated context

### Recommended Global claude.md Template
```markdown
# Agent Instructions

## Identity
- Name: [Your name]
- Preferences: [Communication style, verbosity, format]

## Defaults
- Language: [Primary programming language]
- Style: [Coding style guide reference]
- Testing: [Testing framework and approach]
- Documentation: [Doc style — inline, separate, JSDoc, etc.]

## Rules
- [Non-negotiable rules for all projects]
```
