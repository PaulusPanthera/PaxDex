# PaxDex v0.10 Audit Report

## Data refresh

- Source: corrected PokeMMO Pokédex `dump.zip`, generated 30 July 2026
- 649 Pokédex entries
- 58,370 Pokémon hunt options
- 12,398 full encounter tables
- 12,398 Route Searcher rows
- 649/649 normal sprites, shiny sprites, normal icons and shiny icons retained
- 27 existing route/method tables changed composition
- 7 route/method groups changed seasonal or time availability
- 51 Lure route entries were added and 51 superseded entries were removed, largely reflecting corrected floors/areas

## Import hardening

The corrected dump contains display formatting inside several exported strings and literal control characters that are invalid in strict JSON. The builder now:

- loads these dump strings safely without changing numeric encounter data;
- converts decorated region headers back to Kanto, Hoenn, Unova, Sinnoh and Johto;
- normalizes the decorated Super Rod label back to `Super Rod`;
- removes display-icon prefixes from held items and evolution items;
- verifies that no formatting controls or dump-decoration prefixes reach the generated website data.

## Validation results

- JavaScript syntax: passed
- Python builder and validator compilation: passed
- Generated-data validation: passed
- Every Pokémon detail, hunt, encounter-table and Route Searcher reference resolves
- Every method, share, season, time and confidence value is valid
- Safari Zone Gate remains Headbutt and never receives Safari catch/flee adjustment
- Bulbasaur Lure-exclusive encounter roll remains 5%
- Route 229 Autumn Night 5× Horde remains Ariados 40%, Volbeat 30%, Illumise 30%
- Natural horde blocks remain included in Singles and Lure Singles and separately extractable for Sweet Scent
- Route 32 Lure remains 95% scaled base outcomes plus 5% Lure-exclusive outcome
- Default 5×/3× Horde speeds remain 1,200/720 Pokémon per hour
- Generated JSON contains no leaked control characters or decorated dump labels

## UI scope

No user-interface or scoring logic changed in v0.10. This release updates source data and hardens future dump imports. The v0.9 responsive and GitHub Pages deployment structure is unchanged.

## Declared limitations

- Multiple Lure-exclusive species still divide the 5% Lure roll equally.
- Kanto and Hoenn Safari hunts have no matched catch/flee estimates from the linked community source.
- Settings and favorites remain device/browser-local.
