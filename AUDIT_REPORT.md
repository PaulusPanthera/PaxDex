# PaxDex v0.23 Audit Report

## Changes checked

- A new Training route and navigation tab render independently from the Pokédex, Shiny Hunter and Route Searcher.
- Training data is restricted to 5× hordes.
- EV Training exposes only the maximum expected EV yield found for each pure stat.
- HP variable-yield results show both their average and possible range.
- Attack / Speed and Sp. Attack / Speed categories require an exact 50/50 encounter split.
- The two mixed categories include only their maximum-yield 10-EV pools and clearly explain that each individual horde awards one stat or the other.
- EXP rankings use weighted base EXP yield and average encounter level.
- EXP estimates are explicitly labelled as pre-modifier comparisons rather than exact final payouts.
- Region, season and time filters combine correctly in both training modes.
- Result pagination limits the initial render and expands without changing the selected filters.
- Desktop and 390 px mobile layouts avoid horizontal page overflow.
- Existing Safari naming, Lure corrections, encounter categories and danger-warning behaviour remain intact.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,375 hunt options validate.
- 12,400 full encounter tables and Route Searcher rows validate.
- 2,145 unique 5× training rows validate.
- 395 curated maximum-yield EV rows validate across all eight requested categories.
- No duplicate training rows are generated.
- Every curated EV row equals the highest yield generated for its category.
- Both requested mixed categories validate as exact 50/50 pools.
- Mt. Silver and Cerulean Cave EXP-ranking reference cases pass.
- Existing Lure, Horde, Fossil, Special, Safari-area, catch-estimate, slowdown and wild-danger regressions pass.

## Browser smoke test

- Pure HP, Attack / Speed, Sp. Attack / Speed and EXP modes were exercised with generated data in headless Chromium.
- The default HP result shows Route 123 at 12.5 average HP EV with a 10–15 range.
- Mixed cards show 10 EV per horde and a visible 50% / 50% species split.
- The EXP list begins with an approximately 8,000 base-EXP Mt. Silver horde.
- The 390 px mobile layout has no horizontal page overflow.
- Assets and JSON were supplied through the browser test harness because direct local-page navigation is blocked in the test environment; no page or JavaScript errors were reported.
