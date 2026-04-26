# Multi-Agent Team Workflows

For epics that benefit from parallel specialist work, this project ships a six-role team (lead + explorer + architect + builder + reviewer + tester) defined in `.claude/agents/*.md`. Spawn it on demand and run retros against it.

## Skills

- **`/spawn-team`** — bootstraps the six-role team via `TeamCreate` + parallel `Agent` calls. Idempotent: checks `~/.claude/teams/vorbis-crew/config.json` first; only spawns missing members. Uses project-local `subagent_type` names (`architect`, `reviewer`, etc.) so spawned agents inherit the `.claude/agents/*.md` tool allowlists.
- **`/agent-team-retro`** — structured retrospective on a multi-agent team session. Polls every teammate via `SendMessage`, aggregates into action items, presents via `AskUserQuestion`, and applies approved edits directly to the agent definition files. Cataloging as a GitHub epic via `speckit:catalog` is opt-in.

## Agent definitions

`.claude/agents/*.md` files specify each role's tools, role description, and operating rules. Notable conventions:

- **Universal exit-gate rule** (every agent file): before yielding a turn, audit deliverables; route via `SendMessage` or the turn is incomplete. Plain-text output is invisible to the lead.
- **Tool allowlists explicitly include `SendMessage`, `TaskGet`, `TaskList`, `TaskUpdate`** — required for team participation. The architect and reviewer files restore these because the upstream `feature-dev:code-architect` and `feature-dev:code-reviewer` subagent types omit `SendMessage`, which structurally breaks team communication.
- **Spawn via project-local `subagent_type`**, not upstream `feature-dev:*` types, so the agent inherits the local definition. The `spawn-team` skill handles this automatically.
- **Role-specific guardrails** (interface-contract-first for builder, `npm run test:run` exit-0 completion bar for tester, scope-clarification-up-front for explorer, `TaskList`-before-redirect for lead) — see each `.md` file for the full set.

## When to use

- **`/spawn-team`** at the start of a multi-issue epic when parallel specialist work would help (typically 3+ child issues with distinct domains). The default team name is `vorbis-crew`.
- **`/agent-team-retro`** at the end of a substantive team session, especially before tearing down via `TeamDelete`. Captures lessons before context is lost and iterates the agent definitions.
