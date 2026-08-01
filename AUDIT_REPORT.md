# PaxDex v0.22 Audit Report

## Changes checked

- All data was rebuilt from the newly supplied corrected dump.
- Lure encounter changes propagate into hunt rankings, full splits, encounter-pool previews, Pokédex availability and Route Searcher data.
- Alakazam replaces Lickilicky in the Route 215 Lure slot.
- Charmeleon uses Rock Tunnel 1F rather than B1F.
- Gengar uses Pokémon Tower 3F rather than 7F.
- Pupitar uses Unova Victory Road 1F rather than 7F.
- Mismagius uses the corrected Bell Tower floors.
- Rotom uses Old Chateau 1F rather than 2F.
- Corrected Safari Lure assignments include Great Marsh Area 1 for Sharpedo and Yanmega.
- Existing Safari naming, Grass labels, category logic and self-harm-warning suppression remain intact.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,375 hunt options validate.
- 12,400 full encounter tables and Route Searcher rows validate.
- All full-split, phase-preview and route-table references resolve.
- Corrected Lure-location regressions pass.
- Existing Lure, Horde, Fossil, Special, Safari-area, catch-estimate, slowdown and wild-danger regressions pass.
