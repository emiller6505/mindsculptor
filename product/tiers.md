# Tiers & Business Model

## Philosophy

Keep it cheap. Players are broke from buying cards. This isn't a squeeze — it's a coffee subscription.
The goal: high conversion through genuine value, not friction.

## Tiers

### Anonymous (No account)

- Full metagame charts: all `/data/**` pages, no login required
- Oracle: 3 queries (tracked in localStorage, no DB). After limit: inline prompt to sign up
- No chat history — session only
- No alerts

### Casual (Free account)

- Everything anonymous gets, plus:
- Oracle: 15 queries/day for first 7 days post-signup, then 5/day
- Chat history: read-only access to last 7 days of conversations (no resuming threads)
- Alerts: 1 archetype subscription (in-app only, no email)
- No credit card required, ever

### Spike ($4.99/month)

- Everything in Casual
- Oracle: 30 queries/day
- Chat history: unlimited, fully resumable and searchable (Casual gets read-only 7-day window)
- Deck list generation: oracle generates a recommended 75 for any archetype
- Archetype-specific oracle CTAs: "What should I sideboard against this?" etc.
- Unlimited archetype alert subscriptions
- MTGO alert emails: "Titan just won the Showcase Challenge — here's the list and the meta context"
- Weekly meta digest email per format
- Early access to new formats (Legacy, cEDH when added)
- Annual billing option at ~20% discount

## Paywalled features (planned, not yet)

- Legacy format — Spike only when added
- cEDH — Spike only when added
- API access — Spike or separate add-on

## Payment

- Lemon Squeezy for subscriptions (merchant of record — handles all VAT, sales tax, and year-end tax forms automatically)
- Webhook to Supabase to gate features in real-time
- Google OAuth for auth (Discord planned post-MVP)

## Acquisition & Retention

### Reducing friction
- No CC on free tier, ever
- Value-first: 3 anonymous oracle queries before any auth prompt
- Auth prompt is inline, not a redirect — conversation context is preserved
- 7-day onboarding boost: 15 queries/day for new signups, drops to 5/day on day 8
- Auth via Google (Discord planned post-MVP)
- Soft inline gates, not hard paywall pages

### Increasing stickiness
- Archetype watchlist / alert subscriptions (reason to return)
- Oracle history — queries persist, builds a personal research trail
- Weekly meta digest email (pulls lapsed users back)
- MTGO event digest emails for Spike subscribers
- Discord bot (future) — oracle accessible inside playgroup servers
