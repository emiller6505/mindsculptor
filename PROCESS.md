# Firemind — Process & Conventions

## Task Tracking

All work items live in `beads` (`bd` on the command line). No in-chat task lists.

### Workflow

```
bd ready          # find next unblocked task
bd show <id>      # read full spec before starting
bd update <id> --claim   # claim it (sets you as owner, status → in_progress)
# do the work
bd close <id>     # mark done
```

Each phase ends with an audit task — complete it before closing the phase.

---

## Bead Conventions

### Priority

| Level | Meaning |
|---|---|
| P0 | Production broken / data loss |
| P1 | MVP blocker — must ship |
| P2 | Important, not blocking |
| P3 | Nice to have |
| P4 | Someday / maybe |

### Type

Use the built-in `bd` types:

| Type | When to use |
|---|---|
| `epic` | A phase or large feature grouping child tasks |
| `task` | Standard unit of work |
| `bug` | Something broken that worked (or should work) |
| `chore` | Maintenance, audits, cleanup — no user-facing change |
| `feature` | New user-facing capability |
| `decision` | An ADR — records a decision and its rationale |

### Labels

One or more labels per bead. Use only these:

| Label | For |
|---|---|
| `frontend` | UI, components, pages, Next.js routes |
| `backend` | API routes, server logic, middleware |
| `data` | Scraping, parsing, DB, snapshots, analytics |
| `design` | Visual design, UX, product design |
| `infra` | Render, cron jobs, deployment, environment |
| `seo` | OG images, sitemap, metadata, crawlability |
| `ux` | User flows, rate limiting, gating, onboarding |

Add labels at creation: `bd create --labels backend,ux`
Add labels later: `bd update <id> --add-label frontend`

### Epics and Phases

Each development phase gets an epic. Children use dot notation, automatically assigned by `bd` when `--parent` is set.

```
mindsculptor-toy          ← Phase 5 epic
mindsculptor-toy.1        ← child task
mindsculptor-toy.2        ← child task
```

Parent a bead: `bd create --parent mindsculptor-toy --title "..."`
Reparent later: `bd update <id> --parent mindsculptor-toy`

Standalone beads (bugs, data tasks, infra) don't need a parent unless they're clearly scoped to an active phase.

---

## Commit Messages

Plain English, descriptive, no conventional prefixes.

```
# Good
fix archetype detail page loading on direct navigation
add meta share trend lines to format overview page
update Lemon Squeezy webhook to handle subscription_expired separately

# Not this
feat: add trend lines
fix: navigation bug
chore: update deps
```

---

## Self-Audits

Mandatory after every major feature. Re-read all changed files as a new principal engineer. Check:

- Schema: missing constraints, bad FK design, wrong types, no indexes
- Memory/perf: large data in memory, missing pagination, N+1s
- Type safety: `as any` casts, unchecked assumptions, missing null handling
- ESM/CJS consistency, module resolution, missing config
- Anything that silently fails under real data volumes

Create a bead for every issue found. Never skip.
