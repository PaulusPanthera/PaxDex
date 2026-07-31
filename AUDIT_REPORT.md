# PaxDex v0.20 Audit Report

## Changes checked

- Johto Safari location IDs 343–354 map to the twelve named biomes.
- Johto `Cave` and Sinnoh `Inside` Safari land labels are normalized to `Land`.
- Hoenn Safari location IDs retain their compass names and receive Area 1–6 labels.
- Safari encounter tables and route rows explicitly disable self-harm warnings, while the global Pokédex warning summary remains generated from all encounters.
- Johto land pools are labelled as 90% documented base pools.
- Sinnoh Great Marsh land pools are labelled as 80% documented base pools.
- Lure Safari tables preserve the same source-coverage warning when their underlying base land pool is partial.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,370 hunt options validate.
- 12,398 full encounter tables and Route Searcher rows validate.
- Every Safari table and route row carries source-coverage metadata and disables Safari self-harm warnings.
- All twelve Johto biome labels and all six Hoenn area numbers validate against their stable location IDs.
- Existing Lure, Lure-exclusive, horde, Fossil, Special, Safari Zone Gate, catch-estimate, slowdown and wild-danger regressions pass.

## Browser checks

- Safari hunt cards show the normalized area and Land labels.
- Safari encounter-pool and full-split views contain no self-harm warning icons.
- Johto and Sinnoh partial land pools show Base land pool coverage labels instead of Raw 90% / Raw 80%.
- Route Searcher cards use the same normalized labels and source-coverage presentation.
