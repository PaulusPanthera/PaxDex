# PaxDex v0.12 Audit Report

## Changes audited

- Shiny Hunter exact-form and evolution-line target modes
- Per-route aggregation of multiple evolution forms
- Multi-target encounter-split highlighting
- Hidden-ability exclusion from wild slowdown warnings
- Compact Settings and consolidated About layout
- Updated home and metadata descriptions

## Data status

- Source: corrected PokeMMO Pokédex `dump.zip`, generated 30 July 2026
- 649 Pokédex entries
- 58,370 Pokémon hunt options
- 12,398 full encounter tables
- 12,398 Route Searcher rows
- 649/649 normal sprites, shiny sprites, normal icons and shiny icons retained

## Validation results

- JavaScript syntax: passed
- Python builder and validator compilation: passed
- Generated-data validation: passed
- Every Pokémon detail, hunt, encounter-table and Route Searcher reference resolves
- Every method, share, season, time and confidence value is valid
- Safari Zone Gate remains Headbutt and never receives Safari adjustment
- Bulbasaur Lure-exclusive encounter roll remains 5%
- Route 229 Autumn Night 5× Horde remains Ariados 40%, Volbeat 30%, Illumise 30%
- Natural horde blocks remain included in Singles/Lure Singles and separately extractable for Sweet Scent
- Route 32 Lure remains 95% scaled base outcomes plus 5% Lure-exclusive outcome
- Default 5×/3× Horde speeds remain 1,200/720 Pokémon per hour
- Houndour and Houndoom no longer receive an Unnerve warning because it is their hidden ability
- Growlithe retains its Intimidate warning because Intimidate is a normal wild ability slot

## Browser smoke results

Synthetic browser smoke passed for:

- new route-focused home description
- compact Settings layout
- Exact form to Evolution line switching
- Houndour + Houndoom combined ranking at Valor Lakefront
- per-form encounters/hour breakdown
- both forms highlighted in the full encounter split
- no Houndour/Houndoom hidden-ability slowdown marker
- About methodology and data placement
- 320 px mobile target controls and no horizontal overflow
- no browser console or page errors in the smoke harness

## Declared limitations

- Multiple Lure-exclusive species still divide the 5% Lure roll equally.
- Kanto and Hoenn Safari hunts have no matched catch/flee estimates from the linked source.
- Settings and favorites remain device/browser-local.
- Evolution-line mode combines wild encounter forms only; it does not model eggs or non-wild acquisition methods.
