# PaxDex v0.25 Audit Report

## Result

The readable-URL update and supplied-dump rebuild pass JavaScript syntax, Python compilation, CSS parsing and the complete generated-data validator.

## Navigation checks

- All 649 Pokémon names produce unique URL slugs.
- Name routes include stable handling for gender symbols, punctuation and spaces.
- Numeric routes remain accepted and normalize to their canonical name route.
- Pokémon cards, encounter pools, full splits, training cards and evolution-family buttons all route to readable Pokémon pages.
- The detail-page quick search accepts an exact name, slug or Pokédex number.

## Supplied dump comparison

Compared with the dump used for v0.24:

- 79 Pokémon have changed location data.
- 258 raw location rows were added.
- 84 raw location rows were removed.
- 240 of the additions are Lure-marked location rows.
- The rebuild expands generated data from 58,375 to 66,834 hunt options and from 12,400 to 13,755 encounter tables.

## Generated-data totals

- 649 Pokémon
- 66,834 hunt options
- 13,755 encounter tables
- 13,755 Route Searcher rows
- 2,145 5× training rows
- 395 maximum-yield EV rows
- 124 held-item icons

## Automated checks

- `node --check js/app.js`: passed
- `python -m py_compile scripts/build_data.py scripts/validate_data.py`: passed
- `python scripts/validate_data.py`: passed
- CSS parsed without errors through `tinycss2`
- Phase-preview keys and encounter-table keys match
- All 649 readable slugs are unique
- Headless Chromium smoke passed for readable routes, quick-search navigation, numeric-link compatibility, special-name slugs and 390 px mobile layout.
- No browser console or page errors were recorded during the smoke test.
