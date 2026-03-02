# Design System

## Vibe

"Dracogenius Oracle" — the Firemind has read every tournament result ever recorded and synthesized it into a unified theory of the metagame. Izzet energy: brilliant, analytical, slightly chaotic, electric.

Think dark Ravnica stone, copper and brass arcane apparatus, crackling lightning arcs, blueprint schematics. The machinery is Izzet's steam-arcane engineering — exposed copper, glass condensers, arcane formulae etched into stonework. Not horror, not corruption — genius.

Hints of the aesthetic in micro-details only. Data surfaces are clean and scannable. Usability and accessibility are non-negotiable.

Dark mode first. Grinders play at midnight.

## Color Palette

| Role | Hex | Usage |
|---|---|---|
| Background | `#06080F` | Page background — deep navy-black, like night in Ravnica |
| Surface | `#0C1220` | Cards, panels, modals — cooler blue-black |
| Border/structure | `#172035` | Blue-tinted grid lines, dividers |
| Primary accent | `#4F8EF7` | Electric blue — arcane lightning, CTAs, active states |
| Secondary accent | `#D4552A` | Izzet flame-red — the "fire" in Firemind, heat indicators |
| Copper/detail | `#B87333` | True copper — machinery micro-details, icon accents |
| Gold/Spike | `#C9A050` | Spike tier badge, premium indicators — Niv-Mizzet's scales |
| Text primary | `#E4EEFF` | Body text — cool blue-white, moonlight through arcane glass |
| Text muted | `#4A5878` | Secondary labels, timestamps |
| Danger/alert | `#E85D5D` | Errors, warning states |

## Typography

- **Display/headlines**: Geist or Space Grotesk — geometric, weighted, modern
- **Body**: System sans, highly readable
- **Data/tables**: Tabular nums; Geist Mono or JetBrains Mono for deck lists and counts
- **Oracle output**: Distinct treatment — electric-blue left-border with faint glow, slightly darker surface, copper accent on the "Firemind" label. Feels like the dragon is speaking directly to you.

## Texture & Motifs

- Blueprint schematic line-work in page backgrounds — very low opacity, like technical diagrams on dark stone
- Arcane formulae or runic notation as watermarks in large empty areas
- Hairline borders with faint electric-blue glow on interactive elements — like a live current
- Copper pipe or gear motifs as decorative dividers — never structural, never heavy
- Spark/lightning micro-details on hover states and loading moments
- Never use MTG card art or fantasy illustration in the app chrome; let data be the hero

## Principles

- Dense, not airy — grinders want information density
- Fast perceived performance — optimistic rendering, pre-fetching over skeleton states
- Keyboard-navigable throughout — power users expect it
- Soft gates, not hard blocks — locked Spike features appear grayed inline with contextual upgrade prompts
