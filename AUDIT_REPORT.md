# PaxDex v0.21 Audit Report

## Changes checked

- Johto dump-internal `Cave` Safari encounters normalize to `Grass`.
- Sinnoh dump-internal `Inside` Great Marsh encounters normalize to `Grass`.
- Safari biome and area names remain separate from the encounter method label.
- Johto and Sinnoh partial pools use `Base grass pool` source-coverage wording.
- Existing Safari self-harm-warning suppression remains unchanged.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,370 hunt options validate.
- 12,398 full encounter tables and Route Searcher rows validate.
- No generated Safari table or hunt option retains the custom `Land` encounter type.
- Existing Lure, Horde, Fossil, Special, Safari-area, catch-estimate, slowdown and wild-danger regressions pass.
