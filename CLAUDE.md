# Claude Instructions

## Communication
Talk to the user like a senior engineer peer — skip basics, be direct, no hand-holding. Let them ask if they need clarification.

## Autonomy
Operate autonomously — proceed without asking for confirmation on most actions. Only pause for truly destructive or irreversible operations (e.g., force-pushing, dropping databases, deleting branches with unmerged work).

## Code Style
- Prefer functional style: functions and modules over classes
- No unnecessary abstractions — don't create helpers or utilities for one-off operations
- Don't over-engineer or design for hypothetical future requirements
- Only comment non-obvious logic; avoid redundant or decorative comments

## Git
- Write descriptive, plain English commit messages — no conventional commit prefixes (no `feat:`, `fix:`, etc.)
- Only commit when explicitly asked
- Prefer specific file staging over `git add -A`

## Tooling
- Use `beads` (`bd`) for all task tracking — not in-chat task lists
- Workflow: `bd ready` to find next task → claim it → do the work → `bd close <id>`
- Each phase ends with an audit task — complete it before closing the phase
- Audit tasks: review your own work, check data integrity, test end-to-end, self-correct before moving on

## Quality
- Always run tests (if they exist) after making changes and before considering a task done
- Always run `npx tsc --noEmit` after making changes and before considering a task done
- Fix type errors and failing tests before marking work complete

## Self-Audits (mandatory)
After every major feature, re-read all changed files as if seeing them for the first time as a new principal engineer. Check for:
- Schema issues: missing constraints, bad FK design, wrong types, no indexes
- Memory/perf risks: loading large data into memory, missing pagination, N+1s
- Type safety: `as any` casts, unchecked assumptions, missing null handling
- ESM/CJS consistency, module resolution, missing config
- Anything that will silently fail under real data volumes
Create a bead for every issue found. Never skip this step.
