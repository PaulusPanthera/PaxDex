PAXDEX v0.10 · POKÉDEX DUMP DATA REFRESH
=========================================

A small, clean, 8-bit PokeMMO Pokédex and shiny-hunting route planner.

GITHUB PAGES
------------
1. Create a GitHub repository and place the CONTENTS of this PaxDex folder at its root.
2. Push to the main branch.
3. In GitHub: Settings > Pages > Source: GitHub Actions.
4. The included workflow validates the generated data and deploys only production files.

The site uses hash routes, relative paths and no server-side code, so it works from both
an account Pages domain and a repository subdirectory.

NEW IN v0.10
------------
- Regenerated every Pokédex, hunt, route and encounter-table file from the 30 July 2026 corrected dump.
- Updated Sweet Scent compositions, seasonal/time availability and corrected Lure locations/floors from the new source.
- The updater now safely accepts dump files containing literal control characters or decorative client-string prefixes.
- Region labels, Super Rod labels, held-item names and evolution-item names are normalized before publication.
- Data-only dumps keep the existing sprite library and report its actual retained coverage.
- All v0.9 encounter-model and Safari Zone Gate regression checks remain active.

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
