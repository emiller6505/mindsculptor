# Information Architecture

## Acquisition context

Primary channels: Reddit, Meta ads (Facebook/Instagram), SEO. Podcasts post-MVP.

**Engineering implications:**
- `/formats/[format]` and `/archetypes/[slug]` must be **public and SSR** — not auth-gated. Google needs to crawl them with real data.
- Dynamic OG images per archetype (via `@vercel/og`) — shows meta %, trend arrow, archetype name. Matters for Reddit shares and Meta ad previews.
- Shareable oracle result permalinks — key Reddit/social virality mechanic.
- `/reports/[format]-[date]` pages (see below) — weekly digest published publicly doubles as indexed SEO content.
- Sitemap generation required from day one.
- Cold Meta ad traffic needs a 3-second value prop: *"Know what's winning before you register."*

## Chat history model

| State | History |
|---|---|
| Not logged in | Ephemeral — lost on tab close. No DB storage. |
| Casual (free) | 1 week stored. Older entries exist in DB but render as locked/blurred with upgrade prompt. |
| Spike | Unlimited. Full history always accessible. |

The locked older history creates a natural upgrade hook: Casual users who've been around for a while accumulate a visible trail of past research they can't quite reach.

**History access in the no-sidebar UI:** A `[🕐]` history icon sits in the top bar alongside 🔔 and 📅. Clicking it opens a history drawer — list of past conversations, searchable, with locked entries shown greyed below the 1-week cutoff for Casual users.

## UI model: chat-first, drawer-based

The oracle is the app. Everything else is a drawer or overlay over the chat. No traditional page-based navigation for authenticated users — the chat is always the anchor.

## Navigation (top bar — minimal)

```
[⚡ Firemind Logo]    [Standard][Modern ●]    [🕐 History][🔔 Alerts][📅 Events][avatar ▾]
```

- Format toggle is the only persistent nav control — sets context for all oracle queries
- 🕐, 🔔, and 📅 all open drawers; they are not page navigations
- Avatar opens account dropdown (settings, subscription, sign out)
- Unauthenticated: 🕐 🔔 📅 hidden; show [Sign in] [Go Spike] instead
- No other top-level nav items

## Drawer pattern

All secondary views (archetype detail, events feed, alerts, account settings) slide in as drawers over the chat. The chat remains visible and accessible behind the drawer. Consistent mental model: one place, everything reachable.

## Pages

### `/` — Landing (unauthenticated)

```
Know what's winning. Before you register.
[Ask about the metagame...                    →]
What's dominating Modern?    Best deck for RCQs?
Is Amulet Titan tier 1?      Standard after the ban?
──────────────────────────────────────────────────
MODERN                         STANDARD
Murktide  18.4% ↑   Amulet 13.1% →   Domain 21% ↑↑ ...
[ Sign up free — no credit card ]
```

- Full-width oracle input is the hero — no demo video, no carousel, no hero image
- Suggested queries below input seed curiosity immediately
- Live metagame data below the fold — real numbers, no login required
- Social proof strip: "X events processed · Y queries answered this week"
- Pricing section: Casual vs Spike inline, no separate page needed for the pitch
- CTA: Discord / Google auth, no email/password
- **SEO note**: all text is real HTML, not client-rendered — indexable by Google

### `/` — Home (authenticated, oracle)

- Same URL as landing — auth state determines what renders
- Full-width chat interface, empty state with suggested prompts
- Format toggle in top bar sets oracle context
- Oracle responses embed live data inline (archetype bars, trend arrows) — see below
- Query counter visible near input: "8 / 10 queries today" (Casual) or "24 / 30" (Spike)
- No separate `/dashboard` or `/oracle` route — the home IS the oracle

### Oracle response format (inline data)

Archetype names in oracle responses are tappable — clicking opens the archetype drawer.
Responses with metagame data embed live bars directly in the message bubble:

```
⚡ Firemind
┌─────────────────────────────────────────────────┐
│ Modern is defined by three pillars this week:   │
│                                                 │
│  [Murktide Regent]  ██████████████  18.4%  ↑   │
│  [Amulet Titan]     ██████████      13.1%  →   │
│  [Boros Energy]     ███████          9.7%  ↑↑  │
│                                                 │
│ Energy is the breakout story — gained ~4%       │
│ share in two weeks, back-to-back top 8s...      │
└─────────────────────────────────────────────────┘
```

### Archetype detail drawer

Opens on: clicking an archetype name in any oracle response, or from events drawer.

```
┌── chat (visible behind) ──┬── Boros Energy [×] ──────────────┐
│                            │  Modern · Tier 1                  │
│                            │  Meta share   9.7%   ↑↑           │
│                            │  Win rate     54.2%               │
│                            │  ─────────────────────────────    │
│                            │  Trend  [▁▂▃▄▅▇▇▇▇█]  (30d)      │
│                            │  Representative list  [View →]    │
│                            │                                   │
│                            │  ── Spike ──────────────────────  │
│                            │  Matchup matrix  [blurred]        │
│                            │  "Unlock with Spike — $4.99/mo"   │
│                            │  [Upgrade]                        │
│                            │                                   │
│                            │  [🔔 Subscribe to alerts]         │
└────────────────────────────┴───────────────────────────────────┘
```

### Events drawer (📅 icon)

- Recent MTGO events: Showcase Challenges, Prelims, Leagues
- Filter: format, event type
- Tap event → event detail expands inline within drawer
- Event detail: top 4 (Casual) or top 8/16 (Spike), oracle commentary, winning list link

### Alerts drawer (🔔 icon)

- Subscribed archetypes list (add/remove) — 1 max Casual, unlimited Spike
- Email digest settings: per-format toggle, frequency
- Preview of alert email format
- Upgrade prompt for Casual: "Get email alerts when your archetype top 8s"

### `/pricing` — Standalone page

- Linkable from emails, social, Discord
- Casual vs Spike side-by-side
- FAQ: "Is my data always fresh?" "Can I cancel anytime?"
- No other standalone pages needed for auth'd users — everything is a drawer

### `/settings` — Account (drawer or page)

- Profile, auth connections (Discord/Google)
- Subscription status + Stripe billing portal link
- Query usage this period

## Feature gating pattern

Locked Spike features appear inline within the drawer, blurred, with a contextual upgrade prompt. Never a full-page block. The upgrade CTA is always exactly where the locked content would be.

### `/reports/[format]-[date]` — Public meta reports

- Weekly meta digest published as a public page (same content as Spike email digest)
- Fully SSR, fully indexed — SEO compound value over time
- Canonical URL shared in the digest email itself ("Read online →")
- Example: `/reports/modern-2026-03-09`

### `/oracle/results/[id]` — Shareable oracle result

- Public permalink to a **single oracle response** — never a full conversation thread
- Shows: the query that prompted it, the response, archetype/format context, timestamp
- Deliberately minimal — no surrounding conversation, no user identity exposed
- Social share buttons (Reddit, Twitter/X, copy link)
- CTA: "Get your own oracle queries — it's free" → signup

**Why single-response scope matters:** Chat history (full threads, continuable, searchable) is a Spike feature. Shareable links are read-only snapshots of individual messages — a different artifact entirely. Casual users bookmarking their own share links get a pile of disconnected static cards with no threading, no ability to continue, no organization. It's not a meaningful substitute for in-app history.

## URL conventions

- Archetype slugs: kebab-case, format-scoped if needed (`/archetypes/modern-murktide`, `/archetypes/standard-domain-ramp`)
- Event IDs: source + event ID (`/events/mtgo-challenge-20260228`)
