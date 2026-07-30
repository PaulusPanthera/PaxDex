PAXDEX v0.11 · CLEANER HUNT RESULTS
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

NEW IN v0.11
------------
- Removed repeated ranking-methodology copy from Shiny Hunter result headers.
- Compact hunt cards now show only the useful result and confidence information.
- Full encounter-table explanations are available in a collapsed Calculation notes section.
- Ranking and Safari methodology now lives on the About page.
- Shortened Settings, browser-storage and Today's Find explanations.
- Retains the corrected 30 July 2026 dump data and all v0.10 validation fixes.

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
