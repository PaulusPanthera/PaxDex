PAXDEX v0.12 · EVOLUTION-LINE HUNTING
========================================

A compact, route-first PokeMMO Pokédex and shiny-hunting planner.

GITHUB PAGES
------------
1. Place the CONTENTS of this PaxDex folder at the root of your GitHub repository.
2. Commit and push to the main branch.
3. In GitHub: Settings > Pages > Source: GitHub Actions.
4. The included workflow validates the generated data and deploys production files.

For updates, copy the new patch CONTENTS into the existing repository folder.
Do not delete the existing folder, because its hidden .git directory connects it to GitHub.

NEW IN v0.12
------------
- Added Exact form / Evolution line target scope to Shiny Hunter.
- Evolution-line mode combines every wild evolution form in each route table.
- Combined results show per-form encounters/hour and highlight every target form in the full split.
- Hidden abilities are excluded from wild start-of-battle slowdown warnings.
- Hidden abilities are labelled on Pokémon detail pages.
- Replaced the generic home description with route- and encounter-focused copy.
- Simplified Settings into compact Shiny odds, Display and Encounter speed sections.
- Moved data status and methodology out of Settings and into a cleaner About page.

LOCAL TESTING
-------------
Double-click START_PAXDEX.bat. The site opens at http://localhost:8767.
Opening index.html directly will not work because browsers block local JSON requests.

FEATURES
--------
- Searchable Gen 1-5 Pokédex with normal and shiny PokeMMO sprites
- Stats, abilities, breeding groups, evolution family, held items and moves
- Pokédex filtering by hunt method, generation and availability
- Shiny Hunter for an exact form or complete evolution line
- Route Searcher with Region > Route > Method > Season > Time choices
- Full method-specific encounter split inspector
- Natural horde rolls included in random encounter tables and extracted for Sweet Scent
- Normal-slot start-of-battle slowdown warnings
- Season and time-of-day selectors with optional locks
- Editable shiny bonuses and encounters-per-hour assumptions
- Community Safari estimates for matching Johto Safari and Sinnoh Great Marsh species
- Light, dark and system display modes

DATA
----
Pokédex source: dump.zip
Safari estimate source: https://github.com/ProfessorRex/HGSS-Safari-Zone

Made from PokeMMO Pokedex dump with AI usage by [MÜSH] PaulusPax.
Unofficial fan-made companion; not affiliated with PokeMMO or The Pokémon Company.
