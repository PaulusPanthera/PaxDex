PAXDEX v0.27 · ENCOUNTER PACE DEFAULTS

A static PokeMMO Pokédex, shiny hunting route finder, Route Searcher and EV/EXP training finder.

NEW IN v0.26
- Readable Shiny Hunter URLs such as #hunter/pikachu
- Correct evolution roots and stage ordering from the directed evolution graph
- Proper stage layout for branching evolution families
- Separate Old Rod, Good Rod and Super Rod methods across rankings, filters and settings
- Broad Fishing · Any Rod Pokédex filter remains available
- Re-run-safe GitHub Pages artifact names

CORE DATA
- 649 Pokémon
- 66,834 hunt options
- 13,755 encounter tables / Route Searcher rows
- 2,145 ranked 5× training hordes
- 395 maximum-yield EV rows across 8 categories

SOURCE AND REBUILD
- Source: input/dump.zip
- Builder: scripts/build_data.py
- Validator: scripts/validate_data.py
- Shared safety rules: shared/safety-rules.json

Place a fresh dump at input/dump.zip and run UPDATE_FROM_DUMP.bat.
Run VALIDATE_DATA.bat before publishing.

Made from the PokeMMO Pokédex dump with AI usage by [MÜSH] PaulusPax.
Unofficial fan project; not affiliated with PokeMMO or its developers.
