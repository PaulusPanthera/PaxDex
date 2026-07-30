# PaxDex v0.11

- Removed ranking-methodology text from the Shiny Hunter header.
- Removed generated technical notes from compact hunt cards.
- Moved hunt-ranking and Safari methodology to the About page.
- Collapsed encounter-table explanations into optional Calculation notes.
- Shortened Settings and About copy for a cleaner layout.

# Changelog

## v0.10 · Corrected dump refresh

- Rebuilt PaxDex from the corrected PokeMMO Pokédex dump dated 30 July 2026.
- Updated 27 existing encounter-table compositions and 7 season/time availability groups.
- Applied corrected Lure locations and floor/area assignments from the dump.
- Updated generated totals to 58,370 hunt options and 12,398 full encounter tables.
- Added relaxed JSON loading for literal control characters emitted inside some dump strings.
- Normalized decorated region headers, Super Rod labels, held-item names and evolution-item names.
- Made data-only updates retain and accurately report all 649 normal, shiny and compact sprites.
- Re-ran all encounter-model, Lure, Sweet Scent, Safari and Safari Zone Gate regressions.

## v0.9
- Corrected **Safari Zone Gate**: it is an ordinary Johto location and no longer uses Safari methods, catch adjustments, or flee-rate estimates.
- Its encounter tables are now correctly exposed as **Headbutt** tables.
- Added a permanent data-validation regression test for this location.
- Completed final deployment smoke and GitHub Pages audit.

## v0.8

- Separated encounter-roll probability from the share of individual Pokémon shown.
- Clarified that no-Lure encounter outcomes total 100%, including natural hordes.
- Clarified the 5% Lure transformation: all existing outcomes are scaled to 95%, then the Lure-exclusive outcome is inserted at 5%.
- Added explicit normalized Sweet Scent percentages alongside raw Dex horde-block values.
- Relabeled method speed as individual Pokémon shown per hour.
- Added a Route 32 Lure regression test for the complete 100% outcome table.

## v0.7

- Added Season and Time filters to Route Searcher after Region, Route and Method.
- Route Searcher only lists season/time choices that actually exist for the selected route and method.
- Corrected random encounter tables so the hidden 5% natural horde block is included in Singles, Surfing, Safari and their Lure variants.
- Kept Sweet Scent as a separate extracted view of the same horde block.
- Weighted mixed random tables by individual Pokémon shown, so 3×/5× natural hordes contribute the correct number of shiny checks.
- Added per-species source labels in the encounter split, distinguishing Single, natural Horde, Lure-exclusive and Sweet Scent contributions.
- Added validation regressions for natural horde inclusion in Singles and Lure Singles.


## v0.6

- Added a cascading Route Searcher tab: Region → Route → viable Method.
- Added full route encounter-table inspection with season and time variants.
- Replaced the Pokédex Type filter with Hunt Method.
- Slowdown explanation now appears only when an affected Pokémon is actually in the encounter split.
- Reworked Settings into independent columns to remove large empty grid gaps.
- Reworked About into independent columns for tighter card spacing.
- Added route-index validation and GitHub deployment coverage.

## v0.5 · Encounter split and Safari release

- Made recommended hunt locations clickable.
- Added a full method-specific encounter split with species shares, levels and estimated species encounters/hour.
- Added a red downward warning marker for species that may announce or activate an ability at the start of battle.
- Included the PokeMMO dump ability names currently flagged for possible encounter delay: Intimidate, Reactive Gas, Pressure, Unnerve, Download, Frisk, Forewarn, Anticipation, Trace, Mold Breaker, Turboblaze, Teravolt, Drought, Drizzle, Sand Stream, Snow Warning, Air Lock, Cloud Nine, Slow Start and Imposter.
- Added community-derived balls-only catch and flee estimates for matching Johto Safari and Sinnoh Great Marsh species.
- Added an optional setting to catch-adjust known Safari rankings.
- Left Kanto and Hoenn Safari rankings unadjusted where no matching regional source is available.
- Added 10,985 normalized full encounter tables and validation for every hunt-to-table reference.
- Updated About, data status and deployment checks for the new sources and data files.

## v0.4 · GitHub-ready release

- Completed a desktop, tablet and mobile smoke audit.
- Fixed horizontal overflow on mobile Shiny Hunter result pages.
- Fixed route changes preserving an old scroll position.
- Fixed zero-speed methods appearing in hunt rankings.
- Added more precise target encounters/hour values for rare encounters.
- Added complete compact-icon fallbacks for species missing party icons in the dump.
- Fixed duplicate mono-type values in generated Pokémon detail data.
- Improved keyboard navigation with real card links, a skip link and visible focus states.
- Added page-specific browser titles, favicon, web manifest and social metadata.
- Prevented the main application focus target from showing an unwanted outline.
- Stopped short Settings cards from stretching to match taller cards.
- Added reduced-motion support.
- Expanded data validation and made GitHub deployment depend on passing checks.
- Restricted the deployed Pages artifact to production files only.
- Added an unofficial fan-project disclaimer.
