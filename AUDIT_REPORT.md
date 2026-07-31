# PaxDex v0.19 Audit Report

## Changes checked

- Lure includes all species present in at least one Lure-enabled encounter table.
- Lure-exclusive requires a Lure source and no normal, horde, Safari, fishing, phenomenon or other non-Lure wild source.
- Special contains dump rows whose rarity is marked `Special`, including phenomena.
- Fossil contains all released fossil-revival families through Generation V.
- Pokémon may retain both 100% and Split horde labels on cards, while `dexSearchCategories` removes Split whenever a 100% horde of the same size exists.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,370 hunt options validate.
- 12,398 full encounter tables and Route Searcher rows validate.
- Bulbasaur validates as Lure and globally Lure-exclusive.
- Caterpie validates as Lure but not Lure-exclusive.
- Audino validates under Special phenomena.
- All 17 fossil-family species validate under Fossil.
- No 100%-horde species remains searchable through the corresponding Split filter.
- Existing Lure, natural-horde, Sweet Scent, Safari Zone Gate, Safari estimates, slowdown and wild-danger regressions pass.

## Browser note

The execution environment blocked Chromium from opening local/private-network pages. Browser rendering was therefore not claimed as an automated pass; source syntax, generated data, references and filter semantics were validated directly.
