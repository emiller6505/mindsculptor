# Data Section — Charts & Visualizations

Charts are organized by page. Priority column maps to roadmap tiers.

---

## `/data/[format]` — Format overview

### Meta share bar chart
**Priority: MVP**

Horizontal bars sorted by prevalence, filterable by time range (7d / 30d / 90d),
sortable by meta share or win rate. Every competitor's first question — table stakes.
MTGGoldfish has this; ours will look better and be more filterable.

### Top movers widget
**Priority: MVP**

Not a full chart — a ranked list of biggest gainers and losers week over week.
Fast, scannable, above-the-fold. "Boros Energy +3.8% · Rhinos -2.1%"
Great hook for returning users and shareable on Reddit.

### Meta share trend lines
**Priority: MVP**

Multi-line chart, one line per top archetype over time. The stock chart view.
Lets you see a deck's rise and fall. Highly shareable ("look at this chart").
Time range filter: 30d / 90d / all time.

### Win rate vs meta share scatter plot
**Priority: Post-MVP Tier 1**

X axis: meta share %. Y axis: win rate %. Bubble size: number of events played.
Each bubble is an archetype. The four quadrants tell a story:

```
high win%  │  underplayed gem  │  tier 1 lock
           │                   │
───────────┼───────────────────┼──────────
           │                   │
low win%   │  avoid            │  overplayed
           │                   │
              low meta share      high meta share
```

The clearest visual differentiator from MTGGoldfish. Directly answers "what should
I play" in a way a bar chart can't. Requires no data we don't already have — strong
candidate to pull into MVP if capacity allows.

### Meta diversity index
**Priority: Post-MVP Tier 2**

A single line over time showing format health. Computed from Shannon entropy on meta
share distribution. High = many viable decks, low = one deck dominating.
MTGGoldfish doesn't have this. Gives the oracle a unique talking point:
"The Modern diversity index just hit a 6-month low." Also useful for SEO content
("is Modern a healthy format in 2026?").

---

## `/data/[format]/[archetype]` — Archetype detail

### Meta share over time
**Priority: MVP**

Single line chart — this archetype's meta share % over the last 30/90 days.
Answers: "is this deck rising or falling?"

### Win rate over time
**Priority: MVP**

Single line chart — win rate % over time. Pairs with meta share over time.
The combination is more useful than either alone: a deck falling in share but rising
in win rate signals pilots self-selecting to skilled players — a different story than
a deck that's simply in decline.

### Event placement distribution
**Priority: Post-MVP Tier 1**

Bar chart: how often does this archetype place 1st / top 4 / top 8 / top 16 / out?
Spike potential vs consistency. A deck that top 4s frequently but rarely wins is a
different animal from one that wins or busts. Useful for players deciding whether
to bring a deck to a single-elimination RCQ vs a Swiss event.

### Matchup matrix
**Priority: Post-MVP Tier 1 — Spike only**

Win rate vs each other top archetype, shown as a table/heatmap.
The natural complement to the scatter plot at the format level.
Answers "what do I play into a field of X" in data rather than vibes.
Locked for Casual with contextual upgrade prompt.

### Card frequency breakdown
**Priority: Post-MVP Tier 2**

Which cards appear in 100% of lists (core), 60–80% (near-core), under 50% (flex slots).
Shows where the deck is settled vs in flux. Useful for players tuning their build —
"everyone's running 4 Ragavan, but the 3rd Counterspell is a 50/50 split."

---

## Priority summary

| Chart | Page | Tier |
|---|---|---|
| Meta share bar | `/data/[format]` | MVP |
| Top movers widget | `/data/[format]` | MVP |
| Meta share trend lines | `/data/[format]` | MVP |
| Share over time | `/data/[format]/[archetype]` | MVP |
| Win rate over time | `/data/[format]/[archetype]` | MVP |
| Win rate vs share scatter | `/data/[format]` | Post-MVP Tier 1 |
| Event placement distribution | `/data/[format]/[archetype]` | Post-MVP Tier 1 |
| Matchup matrix (Spike) | `/data/[format]/[archetype]` | Post-MVP Tier 1 |
| Meta diversity index | `/data/[format]` | Post-MVP Tier 2 |
| Card frequency breakdown | `/data/[format]/[archetype]` | Post-MVP Tier 2 |
