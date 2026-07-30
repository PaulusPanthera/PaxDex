# PaxDex v0.13 Audit Report

## Changes audited

- Persistent Shiny Hunter target selection
- Base-form-only evolution-line picker
- Custom visual Pokémon search results
- Type-accented Pokédex card refresh
- Wild held-item icons
- Grouped hunt previews and route species previews
- Collapsible encounter-pace settings

## Data status

- Source: corrected PokeMMO Pokédex `dump.zip`, generated 30 July 2026
- 649 Pokédex entries
- 58,370 Pokémon hunt options
- 12,398 full encounter tables
- 12,398 Route Searcher rows
- 649/649 normal sprites, shiny sprites, normal icons and shiny icons retained
- 124/124 referenced wild held-item icons present

## Validation results

- JavaScript syntax: passed
- Python builder and validator compilation: passed
- Generated-data validation: passed
- Evolution root and line references are valid for all 649 Pokémon
- Every held item referenced by a Pokémon page has an icon or retained fallback
- Existing Lure, natural-horde, Sweet Scent, Safari and Safari Zone Gate regressions passed
- Hidden abilities remain excluded from wild slowdown warnings

## Browser smoke results

Synthetic Chromium smoke passed for:

- exact-form selection and search
- target persistence after season changes
- evolved form normalization to the base form in evolution-line mode
- exclusion of evolved forms from the line-mode picker
- line-result persistence after filter changes
- refreshed Pokédex cards in light and dark mode
- held-item icons and grouped hunt previews
- route-table species previews
- collapsed encounter-pace settings
- 390 px mobile layout with no horizontal overflow
- no browser console or page errors in the smoke harness

## Declared limitations

- Multiple Lure-exclusive species still divide the 5% Lure roll equally.
- Kanto and Hoenn Safari hunts have no matched catch/flee estimates from the linked source.
- Settings and favorites remain device/browser-local.
- Evolution-line mode combines wild encounter forms only; it does not model eggs or non-wild acquisition methods.
