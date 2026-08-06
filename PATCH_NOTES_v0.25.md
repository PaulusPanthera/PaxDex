# PaxDex v0.25 — readable Pokémon links and dump refresh

## Pokémon page navigation

- Pokémon detail pages now use editable name-based URLs such as `#pokemon/pikachu`.
- Special names use stable slugs such as `mr-mime`, `nidoran-f`, `nidoran-m`, `farfetchd` and `ho-oh`.
- Old numeric URLs remain compatible and are rewritten to the canonical name URL after opening.
- Every Pokémon page now has a compact **Jump to Pokémon** search at the top.

## Encounter-data refresh

- Rebuilt PaxDex from `dump(20260806-111003).zip`.
- The supplied dump changes location data for 79 Pokémon.
- Raw location changes: 258 additions and 84 removals.
- Most additions expand Lure coverage across floors, rooms, routes and Safari areas.
- All hunt rankings, encounter pools, full splits, Pokédex availability filters, Route Searcher rows and safety context were regenerated.

## Updated totals

- 649 Pokémon
- 66,834 hunt options
- 13,755 encounter tables
- 13,755 Route Searcher rows
- 2,145 ranked 5× training rows
- 395 maximum-yield EV rows

## Compatibility

No existing shared numeric Pokémon link needs to be changed manually.
