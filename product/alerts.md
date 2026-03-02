# Alerts & Digest System

## Overview

Two distinct email types: event alerts (immediate) and meta digest (periodic).
Both are Spike-tier features, except Casual gets 1 archetype subscription with no email digest.

## Event Alert Email

Triggered when: an MTGO event result is scraped and an alerted archetype placed well.

**Subject line pattern:**
`[Archetype] just won the [Event Name] — [format] meta context inside`

Example: `Amulet Titan just won the MTGO Modern Showcase Challenge`

**Email body:**
1. Result at a glance: archetype, pilot, event name, date, placement
2. The winning list (linked to full list in app)
3. Oracle meta commentary: "Here's what this result means for the current meta" — 2-3 paragraphs of LLM synthesis scoped to that event and format's recent history
4. Surrounding top 8 — brief breakdown of other archetypes that made top 8
5. CTA: "See full event breakdown →"

**Triggering logic:**
- Alert fires if a subscribed archetype places in top 8 (configurable threshold later)
- Deduplicate: one email per event per archetype, not per placement slot
- Rate limit: max 3 alert emails/day to avoid inbox flooding

## Weekly Meta Digest (Spike)

Sent: Sunday morning

**Subject line pattern:**
`Modern meta report — week of [date]`

**Content:**
1. Format headline: biggest mover of the week (gained/lost most meta %)
2. Top 5 archetypes: share %, 7-day trend, oracle one-liner per archetype
3. Notable events this week: top finishes, any breakout performances
4. Oracle synthesis: "What should you be prepared for next weekend?" — actionable paragraph
5. CTA: "Dive deeper in the oracle →"

One digest per format (Standard, Modern) or combined — let users choose in settings.

## Casual tier alerts

- 1 archetype subscription allowed
- In-app notification only (no email digest)
- Email prompt: "Upgrade to Spike to get email alerts when [Archetype] top 8s"

## Technical notes

- Email via Resend or Postmark (transactional, not marketing — high deliverability)
- Oracle synthesis for alerts runs as a background job post-scrape, not on-demand
- Alert preference management at `/alerts`
- Unsubscribe link in every email, one-click, no login required
