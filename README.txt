PAXDEX v0.9 · ENCOUNTER TABLE CLARITY RELEASE
=================================================

A small, clean, 8-bit PokeMMO Pokédex and shiny-hunting route planner.

GITHUB PAGES
------------
1. Create a GitHub repository and place the CONTENTS of this PaxDex folder at its root.
2. Push to the main branch.
3. In GitHub: Settings > Pages > Source: GitHub Actions.
4. The included workflow validates the generated data and deploys only production files.

The site uses hash routes, relative paths and no server-side code, so it works from both
an account Pages domain and a repository subdirectory.

NEW IN v0.9
-----------
- Safari Zone Gate is correctly treated as a normal Headbutt location, not as Safari.
- Full encounter splits now show encounter-roll probability and Pokémon-shown share as separate values.
- No-Lure tables explicitly show that all outcomes, including natural hordes, total 100%.
- The 5% Lure model explicitly scales every existing outcome to 95% before inserting the 5% Lure-exclusive outcome.
- Sweet Scent tables distinguish the raw 5% Dex block from the normalized 100% Sweet Scent method table.
- Method-speed settings are now consistently described as individual Pokémon shown per hour.
- Added a Route 32 Lure regression covering the 95% + 5% transformation and natural 3× hordes.

LOCAL TESTING
-------------
Double-click START_PAXDEX.bat. The site opens at http://localhost:8767.
Opening index.html directly will not work because browsers block local JSON requests.

FEATURES
--------
- Searchable Gen 1-5 Pokédex with normal and shiny PokeMMO sprites
- Stats, abilities, breeding groups, evolution family, held items and moves
- Pokédex filtering by hunt method, generation and availability
- Shiny Hunter ranked by target encounters per hour
- Route Searcher with cascading Region > Route > Method > Season > Time choices
- Full method-specific encounter split inspector
- Complete random-encounter composition including natural horde rolls
- Per-species start-of-battle slowdown ability warnings
- Season and time-of-day selectors with optional locks
- Shiny-odds calculator for Donator Status, 5%/10% Charms and 5%/10%/15% event bonuses
- Community Safari estimates for matching Johto Safari and Sinnoh Great Marsh species
- Light, dark and system display modes
- Favorites displayed directly in the Shiny Hunter
- Correct Sweet Scent normalization of 3x/5x horde blocks

DATA
----
Pokédex source: dump.zip
Safari estimate source: https://github.com/ProfessorRex/HGSS-Safari-Zone

Made from PokeMMO Pokedex dump with AI usage by [MÜSH] PaulusPax.
Unofficial fan-made companion; not affiliated with PokeMMO or The Pokémon Company.
