---
name: spawn-team
description: Bootstrap the canonical team (team-lead + explorer + architect + N builders + reviewer + tester) for multi-file work in this repo. Creates the team via TeamCreate, spawns all specialists in parallel using the project-local agent definitions in `.claude/agents/`, waits for acknowledgments, and reports ready. Builder count is configurable (default 2) — see "Builder count" section. Idempotent — re-running with an existing team only spawns missing members.
triggers:
  - Explicit user request: "spin up the team", "spawn the team", "create the team", "set up the agents", "/spawn-team"
  - Before starting any new multi-file work that benefits from parallel specialist work
allowed-tools: Bash, Read, Agent, SendMessage, TeamCreate
---

# Spawn Team

Recreate the standard team for multi-file work in this repo. The team's behavior, role boundaries, and tool allowlists are defined in the project-local `.claude/agents/*.md` files — this skill orchestrates the spawn; the agent files orchestrate the agents.

The default team name is `vorbis-crew`. If a different team name is desired (e.g. for parallel teams), the user must say so explicitly; otherwise spawn under `vorbis-crew`.

## Builder count

Builder is the only role for which multiple parallel instances are routinely useful — implementation is the bottleneck on most epics, and well-decomposed work parallelizes cleanly. Other roles (architect, reviewer, tester, explorer) stay at one instance because their throughput is rarely the gating constraint and duplicate instances would split context across the same review/test surface.

Pick the count from the nature of the work *before* spawn:

| Situation | Builders | Rationale |
|---|---|---|
| Work scope unknown at spawn time (default) | **2** | Two builders can either parallelize or pair-via-lead-handoff. One sits idle if scope turns out small; cheaper than respawning if scope is large. |
| Single-issue, sequential, or tight dependency chain | 1 | Extra builders would block on the same files. Naming stays as singleton `builder` (no suffix). |
| Known wave with N independent issues (e.g. swarm-style epic) | min(N, 5) | One builder per parallelizable workstream. Cap at 5 — context across more becomes hard for the lead to track. |
| Very small, single-file mechanical fix | 0 (skip skill) | Lead can do it directly. See "When to spawn the full team" below. |

The user may override the count explicitly: *"spawn the team with 3 builders"*, *"just 1 builder, this is sequential"*. Honor the explicit number.

**Naming convention:**
- Count = 1: name is `builder` (no suffix). Preserves the historical singleton convention.
- Count > 1: names are `builder-1`, `builder-2`, ... `builder-N`. Numbered from 1 (not 0). The `-N` suffix here is **intentional and stable**, distinct from the spawn-flake `-2` ghost-name pattern that arises from failed retries.

## When to spawn the full team — proportionality

The full specialist team is sized for **multi-file epics with non-trivial design surface**. Skip it for mechanical work:

| Scope | Right team |
|---|---|
| Multi-file feature, new abstractions, multi-AC spec | Full team (default 2 builders) |
| Known parallel wave (N independent issues) | Full team with min(N, 5) builders |
| Single-file or 2-file fix with no design surface (test-mock fixes, dep bumps, file renames, single-export tweaks) | Lead-only or lead + 1 builder + tester |
| Refactor across 1 module with clear pattern | Lead + 1 builder + reviewer |
| Pure investigation / code reading | Lead + explorer |

Spawning architect for mechanical fixes leaves the role idle the entire session, which surfaces silent-presence bugs (no inbound task → no SendMessage → invisible to lead). When in doubt, start smaller — additional specialists (including more builders) can be spawned later via this same skill (idempotent on existing members).

## Pre-conditions

- `.claude/agents/` must contain definitions for all 5 specialist roles: `explorer.md`, `architect.md`, `builder.md`, `reviewer.md`, `tester.md`. (`team-lead.md` exists for retros and reference but the lead role is the running session itself, not a spawned subagent.) If any are missing, abort and tell the user to run `/agent-team-retro` (which bootstraps them) or to create them manually.
- Working directory must be the project root (`/Users/roman/src/vorbis-player`).

## Process

### Phase 1 — Decide builder count, then check existing team

1. **Resolve target builder count** before touching team state. Apply, in order:
   - User's explicit number (e.g. *"3 builders"*) → use it (clamp to 1–5; warn if > 5).
   - Known parallelizable workstream count (swarm-style epic with N independent issues) → `min(N, 5)`.
   - Otherwise → `2` (default for unknown scope).
   Record the resolved count as `BUILDER_COUNT`.

2. `cat ~/.claude/teams/vorbis-crew/config.json 2>/dev/null` to detect a pre-existing team.
3. If the team exists:
   - Enumerate `members[]`. Treat any name matching `^builder(-\d+)?$` as a builder; collect the rest by exact role name (`explorer`, `architect`, `reviewer`, `tester`).
   - Compute `EXISTING_BUILDERS` = count of builder-matching members.
   - Identify missing non-builder specialists (set difference against `{explorer, architect, reviewer, tester}`).
   - Decide builder action:
     - `EXISTING_BUILDERS == BUILDER_COUNT` → no builder spawns needed.
     - `EXISTING_BUILDERS < BUILDER_COUNT` → spawn `BUILDER_COUNT - EXISTING_BUILDERS` additional builders. Pick names from the lowest unused index in the `builder-N` sequence, skipping any already alive. If `EXISTING_BUILDERS == 1` and the existing name is the singleton `builder` (no suffix), keep it as-is and add `builder-2`, `builder-3`, etc.
     - `EXISTING_BUILDERS > BUILDER_COUNT` → **do not auto-shutdown.** Warn the user with the existing list and the requested count, and ask whether to (a) leave the surplus alive, or (b) explicitly shut down the named extras (separate operation, not part of this skill).
   - If all required members (non-builder set + builder count) are present, report `"Team already up — N specialists registered (M builders)"` and exit.
   - Otherwise proceed to Phase 3 to spawn only the missing members.
4. If the team does not exist, proceed to Phase 2.

### Phase 2 — Create the team

Call `TeamCreate`:

```
team_name: vorbis-crew
agent_type: lead
description: Cross-functional team for epic work — lead orchestrates; specialists cover research, architecture, implementation, review, and testing.
```

The current session becomes the team-lead by default.

### Phase 3 — Spawn specialists in parallel

For each specialist not already alive, spawn via `Agent` in a single message with multiple parallel tool calls (background mode so the lead can continue). Builders are templated — instantiate one `Agent` call per builder name resolved in Phase 1.

| Role | `subagent_type` | `name` | `model` (override) |
|---|---|---|---|
| explorer | `explorer` | `explorer` | (default) |
| architect | `architect` | `architect` | `sonnet` |
| builder (singleton, count=1) | `builder` | `builder` | `opus` |
| builder (multi, count>1) | `builder` | `builder-1`, `builder-2`, … `builder-N` | `opus` |
| reviewer | `reviewer` | `reviewer` | `sonnet` |
| tester | `tester` | `tester` | `sonnet` |

All builder instances share the same `subagent_type` (`builder`) and the same `.claude/agents/builder.md` definition — they're parallel workers, not differentiated specialists. The `name` is the only thing that varies.

**Use the project-local `subagent_type`** (the lowercase role name matching the `.claude/agents/{name}.md` file). This loads the agent definition with the correct tools (including `SendMessage` for architect and reviewer — the upstream `feature-dev:*` types omit it, which structurally breaks team communication).

If a project-local `subagent_type` is not resolved by Claude Code, fall back per role:

| Role | Fallback | Caveat |
|---|---|---|
| explorer | `Explore` | Default tools include SendMessage — works |
| architect | `feature-dev:code-architect` | **Missing SendMessage — agent will appear silent.** Warn the user. |
| builder | `general-purpose` | All tools — works |
| reviewer | `feature-dev:code-reviewer` | **Missing SendMessage — agent will appear silent.** Warn the user. |
| tester | `test-engineer` | All tools — works |

For each spawn, the prompt should be terse — the agent's behavior is fully described in `.claude/agents/{role}.md` (where `{role}` is the role file, e.g. `builder.md` for any `builder-N` instance). Sample:

```
You are "{name}" on the vorbis-crew team. Your full role definition is in
.claude/agents/{role}.md — read it now.

Acknowledge in one sentence (do not preload the codebase yet — wait for a specific task).
Then go idle. Tasks will arrive via SendMessage from "team-lead" and the team task list.
```

For multi-builder spawns, append one extra line to disambiguate: *"You are one of {N} builders on this team — sibling instances are {sibling-names}. The lead may dispatch independent work to each of you in parallel."* This prevents a builder from assuming it owns the whole queue.

Set `team_name: vorbis-crew` and `name: {name}` on every Agent call so the spawned agent joins as a teammate. The `{name}` is the per-instance name (e.g. `builder-1`), not the role.

### Phase 4 — Confirm ready

1. Wait for each spawned agent's first message (acknowledgment) — they should send via `SendMessage` per their role definition's exit gate. Each builder instance acks independently.
2. If any agent goes silent for two turns (no ack), warn the user — likely a `SendMessage` provisioning gap (the architect/reviewer fallback caveat) or a spawn-flake. Name the silent agent(s) explicitly so the user can decide whether to respawn.
3. Report final state with builder count broken out: e.g. `"Team ready: explorer, architect, builder-1, builder-2, reviewer, tester (6 specialists, 2 builders)"`. List any failed acks separately.

## Constraints

- **Never spawn duplicate members.** Always check `~/.claude/teams/vorbis-crew/config.json` first. For builders, "duplicate" means a name collision — `builder-2` already alive cannot be re-spawned, but `builder-3` may be added on top.
- **Never spawn the team-lead as a subagent.** The lead is the running session.
- **Use project-local `subagent_type` first.** Fallback to upstream types only if the local resolution fails, and warn the user about the SendMessage gap when falling back to `feature-dev:*` types.
- **Spawn in parallel via a single message** with multiple `Agent` tool calls — sequential spawning is wasted time. This includes multiple builder instances in the same batch.
- **Use `run_in_background: true` on every spawn** so the lead can continue without waiting for each agent's setup turn.
- **Do not assign work in this skill.** The skill only bootstraps the team. Task dispatch (including which builder gets which task) is a separate concern handled by the lead after this skill exits.
- **Do not auto-shutdown surplus builders.** If `EXISTING_BUILDERS > BUILDER_COUNT`, surface the mismatch and let the user decide. Tearing down a busy builder mid-task corrupts the team.
- **Do not modify `.claude/agents/*.md` files.** This skill consumes them; only `agent-team-retro` writes to them. The single `builder.md` definition serves all builder instances — there is no per-instance specialization.
