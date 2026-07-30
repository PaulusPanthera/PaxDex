PAXDEX v0.15 · COMPLETE PICKER SCROLLING
==========================================

A compact, route-first PokeMMO Pokédex and shiny-hunting planner.

GITHUB PAGES
------------
1. Copy the CONTENTS of this PaxDex folder into the root of your existing GitHub repository folder.
2. Replace matching files, but do not delete the repository folder or its hidden .git directory.
3. Commit and push to main in GitHub Desktop.
4. The included workflow validates the generated data and deploys the production site.

NEW IN v0.15

- The empty Shiny Hunter picker now includes every eligible Pokémon or evolution line in Pokédex order.
- Removed the hidden 12-entry browse cap that made the scrollbar stop early.
- Added rendering containment so the complete list remains responsive.
------------
- Added a visual Pokémon picker with sprites, types and Pokédex numbers.
- Selected targets persist while changing season, time or target scope.
- Evolution-line mode shows base forms only.
- Refreshed Pokédex cards and route-table previews.
- Added icons for all currently listed wild held items.
- Grouped duplicate hunt-preview rows on Pokémon pages.
- Collapsed advanced encounter-speed settings.

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
- Editable shiny bonuses and encounters-per-hour assumptions
- Community Safari estimates for matching Johto Safari and Sinnoh Great Marsh species
- Light, dark and system display modes

DATA
----
Pokédex source: dump.zip
Safari estimate source: https://github.com/ProfessorRex/HGSS-Safari-Zone

Made from PokeMMO Pokedex dump with AI usage by [MÜSH] PaulusPax.
Unofficial fan-made companion; not affiliated with PokeMMO or The Pokémon Company.
