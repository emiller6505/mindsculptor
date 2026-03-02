# Tiers & Business Model

## Philosophy

Keep it cheap. Players are broke from buying cards. This isn't a squeeze — it's a coffee subscription.
The goal: high conversion through genuine value, not friction.

## Tiers

### Casual (Free)

- Full metagame charts: deck breakdown, meta share, win rate, trends — Standard + Modern
- Archetype detail pages: play rates, win rates, recent results — all free
- 12-hour fresh data
- Oracle: 5 queries/day
- No chat history (ephemeral if logged out; logged-in Casual gets no persistent history)
- Alerts: 1 archetype subscription (in-app only, no email)
- No credit card required, ever

### Spike ($4.99/month)

- Everything in Casual
- Oracle: 30 queries/day
- Chat history: unlimited (full history, searchable, resumable)
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

- Stripe for subscriptions
- Webhook to Supabase to gate features in real-time
- Discord OAuth + Google OAuth for auth (no email/password friction)

## Acquisition & Retention

### Reducing friction
- No CC on free tier, ever
- 7-day Spike trial, no CC required
- Auth via Discord (MTG's native community) or Google
- Soft inline gates, not hard paywall pages — free users see oracle results partially, with "upgrade to continue"

### Increasing stickiness
- Archetype watchlist / alert subscriptions (reason to return)
- Oracle history — queries persist, builds a personal research trail
- Weekly meta digest email (pulls lapsed users back)
- MTGO event digest emails for Spike subscribers
- Discord bot (future) — oracle accessible inside playgroup servers
