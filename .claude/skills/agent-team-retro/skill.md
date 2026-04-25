---
name: agent-team-retro
description: Run a structured retrospective on a multi-agent team session. Polls every teammate (and the lead) for what went well, what could improve, and proposed agent-definition changes; aggregates the responses; presents an action-item list for user approval; and applies approved edits directly to the agent definition files. Optionally catalogs as a GitHub epic when the user explicitly opts in. Bootstraps project-local agent definition files (`.claude/agents/`) when missing.
triggers:
  - End of a multi-agent team session (proactively offer when work concludes)
  - Explicit user request: "run a retro on the team", "/agent-team-retro", "team retrospective"
  - After a TeamDelete call, before clearing the conversation
allowed-tools: Bash, Read, Write, Edit, SendMessage, TaskList, TaskGet, AskUserQuestion, Skill
---

# Agent Team Retro

Reflect on a multi-agent team session by polling every member, then turn the findings into local edits to the team's agent definitions. Cataloging as a GitHub epic is opt-in, not the default — most retros want fast iteration, not ticket overhead.

## When to Run

- After a team has finished a substantive piece of work (an epic, a multi-task initiative).
- When the user explicitly asks for a retrospective.
- Before tearing down a team via `TeamDelete` — capture the lessons before context is lost.

Skip when:
- Only the lead participated (single-agent session — no team to retro).
- The team did fewer than ~3 task assignments (not enough signal).

## Process

### Phase 1 — Bootstrap project-local agent definitions

1. Read the team config: `~/.claude/teams/{team_name}/config.json` to enumerate `members[]`.
2. For each member, check whether `.claude/agents/{member.name}.md` exists in the project.
3. For missing files, write a stub with frontmatter (`name`, `description`, `tools`) and an empty body. Use the upstream subagent's documented tools as a starting point, **and explicitly add `SendMessage`, `TaskGet`, `TaskList`, `TaskUpdate`** if missing — these are required for team participation but are not always in the upstream defaults (notably, `feature-dev:code-architect` and `feature-dev:code-reviewer` ship without `SendMessage`).
4. Tell the user which stubs were created (one line each); do not solicit approval — bootstrapping is idempotent and reversible.

### Phase 2 — Poll the team

1. SendMessage to each member (excluding the lead) with this exact retro prompt:

   > **Team retro — please respond by calling `SendMessage({to: "team-lead", summary: "retro response", message: "<your three answers>"})`. Do not reply in plain text — the lead's context only sees output routed via SendMessage. Three questions, ≤200 words total:**
   >
   > 1. **What went well in your role this session?** Be specific — name a moment, not a generality.
   > 2. **What could have gone better?** Process, prompt, tool access, communication with the lead — anything in scope.
   > 3. **One concrete change to your agent definition you'd want.** A capability to add, an instruction to clarify, a tool to enable. One change, not a wishlist.
   >
   > **If `SendMessage` is not in your toolset, reply with that fact (in plain text — the user will relay).** That itself is the most important data point.

2. The lead writes their own retro inline using the same three questions, plus a fourth:
   > 4. **Observations about each member** — one line per teammate covering reliability, communication quality, output quality. Distinguish role-level patterns (e.g. "the reviewer subagent type idled silently twice") from individual incidents.

3. Wait for responses. **If a member appears silent for two turns, check first whether `SendMessage` is in their tool allowlist** (read `~/.claude/teams/{team_name}/config.json` for their `agentType` and cross-reference against the Agent tool's documented tool list). If `SendMessage` is missing, ask the user to relay the member's plain-text output from their console — do not assume the member produced nothing. If the member is genuinely shut down, fall back to the lead's third-person observations for that role.

### Phase 3 — Aggregate

1. Collect responses into a working list (in conversation; don't write a doc unless asked).
2. **Deduplicate by theme** — when multiple members raise the same issue, collapse into a single action item with all sources cited.
3. **Tag each item** with: source agent(s), severity (high / medium / low), category (definition / prompt / tools / communication / process), and target file(s).
4. **Sort** by severity, then by frequency (cited by multiple agents = higher).

### Phase 4 — Present for approval (use `AskUserQuestion`)

Use the `AskUserQuestion` tool to present items grouped by severity (HIGH / MEDIUM / LOW), with `multiSelect: true` so the user can approve subsets in one round-trip. Do not present items as a free-form table that requires the user to type out approvals — that's slow and error-prone.

Include a final question asking the user how to proceed after approval:

- **Apply approved items now, stage the diffs (default — recommended)** — edit the target files directly; leave changes uncommitted for user review.
- **Apply approved items + catalog as GitHub epic** — both apply locally and create tracking issues for retrospective visibility.
- **Catalog only, don't apply yet** — only useful when the user wants a written record without modifying agent definitions immediately.

The default is **apply, don't catalog**. Cataloging is opt-in.

### Phase 5 — Apply (default)

For each approved item:

1. Locate the target file (`.claude/agents/*.md` or `.claude/skills/agent-team-retro/skill.md`).
2. Edit the file with the approved change. If the file body is empty (just frontmatter from the bootstrap stub), write a complete role definition incorporating the approved rules. If the file has prior content, use `Edit` to add the new rule in the appropriate section.
3. Stage the diffs in git but **do not commit** — the user reviews then commits manually (or uses `flowkit:commit`).
4. Report what changed: list each modified file with a one-line summary of the rule added.

### Phase 6 — Optional: catalog as GitHub epic (opt-in only)

Only run this phase if the user explicitly chose the "Apply + catalog" or "Catalog only" option in Phase 4.

1. Invoke `speckit:catalog` with the approved items as input. The skill produces a GitHub epic with one child issue per item.
2. Use these labels on every issue: `agent-improvement`, plus one of `definition` / `prompt` / `tools` / `communication` / `process` matching the item's category.
3. Each issue body must include: source agent(s), severity, target file, proposed change, and a back-reference to the retro session (date + team name).
4. Report the epic URL and child issue count back to the user.

## Constraints

- **Never write to `.claude/agents/*.md` beyond the Phase 1 stub bootstrap without explicit user approval via `AskUserQuestion`.** Phase 5 application requires per-item approval recorded in the AskUserQuestion answer.
- **Cataloging is opt-in.** Phase 6 only runs when the user explicitly chose a catalog-inclusive option in Phase 4. The default flow is apply-only.
- **Use `AskUserQuestion` for the approval step**, not free-form prose. Group items by severity into separate questions with `multiSelect: true`.
- **Never poll the team in parallel with the lead's own retro** — collect peers' responses first so the lead's observations can incorporate them.
- **Skip solo sessions.** If `members.length === 1`, abort with "Single-agent session — nothing to retro."
- **Cap each member's response at ≤200 words.** If a response exceeds that, summarize before aggregating; do not paraphrase the substance away.
- **Preserve member identity in citations.** Action items must always trace back to who raised them, so future retros can detect recurring patterns from the same agent.
- **Do not invent action items.** Every entry presented in Phase 4 must be backed by at least one direct member quote or the lead's documented observation.
- **Idempotent bootstrap.** Phase 1 must never overwrite an existing `.claude/agents/*.md` file. If a file exists, skip silently.
- **Investigate apparent silence before bypassing.** When a member doesn't respond for two turns, check their tool allowlist for `SendMessage` *and* ask the user to check the console — do not assume the member is broken.
