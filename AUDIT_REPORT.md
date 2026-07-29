# PaxDex v0.9 Audit Report

## Changes audited

- Route Searcher Season and Time filtering
- Cascading viable option generation
- Natural 5% horde inclusion in random encounter methods
- Lure table composition with preserved natural hordes
- Sweet Scent extraction as a separate method
- Per-species encounter-source labels

## Automated checks

- JavaScript syntax: passed
- Python builder/validator compilation: passed
- Generated data validation: passed
- 649 Pokédex entries
- 58,397 Pokémon hunt options
- 12,418 encounter tables and route-search rows
- Every generated encounter split totals 100% of Pokémon shown
- Every natural-horde table contains an explicit horde source
- Bulbasaur lure-exclusive encounter roll = 5%
- Route 229 Sweet Scent 40/30/30 regression: passed
- Route 229 Singles includes the natural horde contribution: passed
- Route 229 Lure Singles preserves the natural horde contribution: passed
- Default 5×/3× Horde speeds remain 1,200/720 per hour

## Encounter-model interpretation

- The dump's normal 95% block and hidden 5% horde block form the complete no-Lure random encounter table.
- Natural horde contributions are weighted by their 3× or 5× Pokémon count when calculating target encounters/hour.
- A Lure table uses 95% of that complete random table plus a 5% lure-exclusive encounter roll.
- Sweet Scent independently normalizes the extracted horde block to 100%.

## Declared limitations

- Multiple Lure-exclusive species still divide the 5% Lure roll equally.
- Kanto and Hoenn Safari hunts have no matched catch/flee estimates from the linked source.
- Settings and favorites remain device/browser-local.
- Browser execution smoke testing was unavailable in the build environment because local-network pages are blocked by browser policy; syntax, generated-data and structural checks passed.


## v0.8 clarification audit

- No-Lure outcomes remain a complete 100% table, including natural hordes.
- The 5% Lure model scales the complete base table to 95% and adds the exclusive slot at 5%.
- Encounter-roll chance and Pokémon-shown share are now displayed independently.
- Route 32 Summer Morning Lure regression verifies 95% non-Lure outcomes, 5% Totodile, and 1.095 Pokémon shown per roll.

## v0.9 final release audit
- Safari Zone Gate is classified as Headbutt and never as Safari.
- No Safari catch/flee estimate is attached to Safari Zone Gate encounters.
- Generated route, hunt, compact-index and full-split data agree.
- Python validation, JavaScript syntax, static asset requests and responsive Chromium smoke checks passed.

## Final v0.9 publish gate

- Safari Zone Gate: 6/6 generated tables classified as **Headbutt**.
- Safari flag: false for every Safari Zone Gate table, route row and Pokémon hunt entry.
- Safari catch/flee estimates: none attached to Safari Zone Gate.
- 1,304 generated JSON files parsed successfully.
- 649 compact Pokédex method lists cross-checked against their detailed hunt files.
- All production assets returned HTTP 200 from the local static server.
- Relative asset paths and hash routing remain compatible with GitHub Pages project subdirectories.
- No localhost dependency exists in production HTML, CSS or JavaScript.
