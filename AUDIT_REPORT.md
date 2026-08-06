# PaxDex v0.26 Audit Report

## Result

The v0.26 rebuild passes the complete generated-data validator, independent data-reference audit, JavaScript syntax, Python compilation, CSS parsing and workflow-YAML parsing.

## Hunter navigation

- All 649 Pokémon produce unique readable slugs.
- Shiny Hunter links use `#hunter/<name>` throughout the picker, favorites, Pokédex actions and hunt previews.
- Numeric links remain accepted and are rewritten to the readable route.
- Evolution-line mode rewrites evolved-form routes to the actual base-form slug.
- Pure JavaScript helper smoke tests passed for numeric/name resolution and exact/line target normalization.

## Evolution-family audit

- 329 directed evolution families validated.
- Every family root has no in-family parent.
- Every family member is reachable from its root.
- Index, detail, stage and root records agree for all 649 Pokémon.
- 47 Pokémon records across 17 families changed relative to v0.25.
- Known regressions validate Pichu, Cleffa, Tyrogue, Happiny, Mime Jr., Munchlax and Budew as the correct roots.
- Branching families such as Eevee, Tyrogue, Wurmple and Nincada have stage-based layouts.

## Rod separation audit

Encounter-table methods now match their actual rod type:

- Old Rod: 297 tables, including 30 Safari tables
- Good Rod: 496 tables, including 44 Safari tables
- Super Rod: 644 tables, including 42 Safari tables

The same mapping is consistent across encounter tables, per-Pokémon hunt files and Route Searcher rows. Every rod species receives its specific rod category plus the broad Fishing category.

## Generated totals

- 649 Pokémon
- 66,834 hunt options
- 13,755 encounter tables
- 13,755 Route Searcher rows
- 2,145 5× training rows
- 395 maximum-yield EV rows
- 124 held-item icons
- 1,309 JSON files parsed successfully
- Four complete 649-sprite sets

## Deployment workflow

The Pages upload and deployment steps use the same `github-pages-${{ github.run_attempt }}` artifact name, preventing duplicate-name failures when a workflow run is re-triggered.

## Browser-test limitation

The container's Chromium process could not complete local navigation because its headless runtime hangs on the unavailable system DBus. Therefore the audit does not claim a fresh visual Chromium screenshot pass. Static route/helper tests, generated-data validation, source inspection and all syntax/structure checks passed.
