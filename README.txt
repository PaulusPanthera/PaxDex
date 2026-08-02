PAXDEX v0.24 · CONTEXT-AWARE SHINY SAFETY

A static PokeMMO Pokédex, shiny hunting route finder, Route Searcher and EV/EXP training finder.

NEW IN v0.24
- Shared context-aware wild safety rules
- Rage Powder and Follow Me warnings for multi-opponent encounters
- Belly Drum, Teleport, Sticky Barb, Sketch, Transform and held-item swap warnings
- Correct Perish Song handling for hordes
- Detailed preparation advice inside full encounter splits
- Safari battle and slowdown warnings fully suppressed

CORE DATA
- 649 Pokémon
- 58,375 hunt options
- 12,400 encounter tables / Route Searcher rows
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
