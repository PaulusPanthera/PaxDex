# PaxDex v0.14 Audit Report

## Changes audited

- Deterministic, labeled Shiny Hunter picker ordering
- Scroll-safe picker behavior
- Keyboard picker navigation
- Evolution-line lookup by evolved-form name
- Wild encounter methods on Pokémon detail pages
- Full method tooltips on Pokédex cards

## Data status

- Source: corrected PokeMMO Pokédex `dump.zip`, generated 30 July 2026
- 649 Pokédex entries
- 58,370 Pokémon hunt options
- 12,398 full encounter tables
- 12,398 Route Searcher rows
- 124 referenced wild held-item icons retained

## Validation results

- JavaScript syntax: passed
- Python builder and validator compilation: passed
- Generated-data validation: passed
- Existing Lure, natural-horde, Sweet Scent, Safari and Safari Zone Gate regressions passed
- Hidden abilities remain excluded from wild slowdown warnings

## Browser smoke coverage

- Empty picker ordering and section labels
- Query result ranking
- Evolution-line search using an evolved-form name
- Picker scrolling without accidental closure
- Mouse and keyboard selection
- Wild method display on Pokémon entries
- Light/dark desktop and 390 px mobile layouts
- No browser console or page errors

## Declared limitations

- Multiple Lure-exclusive species still divide the 5% Lure roll equally.
- Kanto and Hoenn Safari hunts have no matched catch/flee estimates from the linked source.
- Settings and favorites remain device/browser-local.
- Evolution-line mode combines wild encounter forms only; it does not model eggs or non-wild acquisition methods.
