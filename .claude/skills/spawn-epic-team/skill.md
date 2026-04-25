---
name: spawn-epic-team
description: Bootstrap the canonical 6-role epic team (team-lead + explorer + architect + builder + reviewer + tester) for working on an epic. Creates the team via TeamCreate, spawns all 5 specialists in parallel using the project-local agent definitions in `.claude/agents/`, waits for acknowledgments, and reports ready. Idempotent — re-running with an existing team only spawns missing members.
triggers:
  - Explicit user request: "spin up the team", "spawn the epic team", "create the team", "set up the agents for this epic", "/spawn-epic-team"
  - Before starting any new epic that benefits from parallel specialist work
allowed-tools: Bash, Read, Agent, SendMessage, TeamCreate
---

# Spawn Epic Team

Recreate the standard 6-role team for epic work in this repo. The team's behavior, role boundaries, and tool allowlists are defined in the project-local `.claude/agents/*.md` files — this skill orchestrates the spawn; the agent files orchestrate the agents.

## When to spawn the full team — proportionality

The 5-specialist team is sized for **multi-file epics with non-trivial design surface**. Skip it for mechanical work:

| Scope | Right team |
|---|---|
| Multi-file feature, new abstractions, multi-AC spec | Full 5-specialist team |
| Single-file or 2-file fix with no design surface (test-mock fixes, dep bumps, file renames, single-export tweaks) | Lead-only or lead + builder + tester |
| Refactor across 1 module with clear pattern | Lead + builder + reviewer |
| Pure investigation / code reading | Lead + explorer |

Spawning architect for mechanical fixes leaves the role idle the entire session, which surfaces silent-presence bugs (no inbound task → no SendMessage → invisible to lead). When in doubt, start smaller — additional specialists can be spawned later via this same skill (idempotent on existing members).

## Pre-conditions

- `.claude/agents/` must contain definitions for all 5 specialist roles: `explorer.md`, `architect.md`, `builder.md`, `reviewer.md`, `tester.md`. (`team-lead.md` exists for retros and reference but the lead role is the running session itself, not a spawned subagent.) If any are missing, abort and tell the user to run `/agent-team-retro` (which bootstraps them) or to create them manually.
- Working directory must be the project root (`/Users/roman/src/vorbis-player`).

## Process

### Phase 1 — Check existing team

1. `cat ~/.claude/teams/vorbis-epic/config.json 2>/dev/null` to detect a pre-existing team.
2. If the team exists:
   - Enumerate `members[]` and compare against the canonical 5 specialist names.
   - Identify any missing specialists.
   - If all 5 are present, report "Team already up — all 5 specialists registered" and exit. Do not re-spawn — duplicates would conflict.
   - If some are missing, proceed to Phase 3 to spawn only the missing members.
3. If the team does not exist, proceed to Phase 2.

### Phase 2 — Create the team

Call `TeamCreate`:

```
team_name: vorbis-epic
agent_type: lead
description: Cross-functional team for epic work — lead orchestrates; specialists cover research, architecture, implementation, review, and testing.
```

The current session becomes the team-lead by default.

### Phase 3 — Spawn specialists in parallel

For each specialist not already alive, spawn via `Agent` in a single message with multiple parallel tool calls (background mode so the lead can continue):

| Role | `subagent_type` | `name` | `model` (override) |
|---|---|---|---|
| explorer | `explorer` | `explorer` | (default) |
| architect | `architect` | `architect` | `sonnet` |
| builder | `builder` | `builder` | `opus` |
| reviewer | `reviewer` | `reviewer` | `sonnet` |
| tester | `tester` | `tester` | `sonnet` |

**Use the project-local `subagent_type`** (the lowercase role name matching the `.claude/agents/{name}.md` file). This loads the agent definition with the correct tools (including `SendMessage` for architect and reviewer — the upstream `feature-dev:*` types omit it, which structurally breaks team communication).

If a project-local `subagent_type` is not resolved by Claude Code, fall back per role:

| Role | Fallback | Caveat |
|---|---|---|
| explorer | `Explore` | Default tools include SendMessage — works |
| architect | `feature-dev:code-architect` | **Missing SendMessage — agent will appear silent.** Warn the user. |
| builder | `general-purpose` | All tools — works |
| reviewer | `feature-dev:code-reviewer` | **Missing SendMessage — agent will appear silent.** Warn the user. |
| tester | `test-engineer` | All tools — works |

For each spawn, the prompt should be terse — the agent's behavior is fully described in `.claude/agents/{name}.md`. Sample:

```
You are "{name}" on the vorbis-epic team. Your full role definition is in
.claude/agents/{name}.md — read it now.

Acknowledge in one sentence (do not preload the codebase yet — wait for a specific task).
Then go idle. Tasks will arrive via SendMessage from "team-lead" and the team task list.
```

Set `team_name: vorbis-epic` and `name: {role}` on every Agent call so the spawned agent joins as a teammate.

### Phase 4 — Confirm ready

1. Wait for each spawned agent's first message (acknowledgment) — they should send via `SendMessage` per their role definition's exit gate.
2. If any agent goes silent for two turns (no ack), warn the user — likely a `SendMessage` provisioning gap (the architect/reviewer fallback caveat).
3. Report final state: which specialists are alive, which (if any) failed to ack.

## Constraints

- **Never spawn duplicate members.** Always check `~/.claude/teams/vorbis-epic/config.json` first.
- **Never spawn the team-lead as a subagent.** The lead is the running session.
- **Use project-local `subagent_type` first.** Fallback to upstream types only if the local resolution fails, and warn the user about the SendMessage gap when falling back to `feature-dev:*` types.
- **Spawn in parallel via a single message** with multiple `Agent` tool calls — sequential spawning is wasted time.
- **Use `run_in_background: true` on every spawn** so the lead can continue without waiting for each agent's setup turn.
- **Do not assign work in this skill.** The skill only bootstraps the team. Task dispatch is a separate concern.
- **Do not modify `.claude/agents/*.md` files.** This skill consumes them; only `agent-team-retro` writes to them.
