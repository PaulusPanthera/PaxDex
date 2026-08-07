PAXDEX v0.28 · FISHING MODIFIERS, FOSSILS & ALTERING CAVE

A static PokeMMO Pokédex, shiny hunting route finder, Route Searcher and EV/EXP training finder.

NEW IN v0.28
- Fishing + Lure: 340/hr
- Fishing + Chum Bucket: 460/hr
- Fishing + Lure + Chum Bucket: 470/hr
- Modifier modes reuse the exact Old/Good/Super Rod species tables
- Fossil revival hunts: 530/hr for the 9 directly revivable fossil species
- Altering Cave community rotation planner using the supplied Team Méw data
- Dark Rotation 3 is inferred as the current supplied pool
- Altering Cave encounter rates are not invented; rotation pools stay outside hunt rankings until percentages are sourced

CORE DATA
- 649 Pokémon
- 80,796 hunt options
- 18,075 encounter tables / Route Searcher rows
- 2,145 ranked 5× training hordes
- 395 maximum-yield EV rows across 8 categories

SOURCE AND REBUILD
- Source: input/dump.zip
- Builder: scripts/build_data.py
- Validator: scripts/validate_data.py
- Shared safety rules: shared/safety-rules.json
- Altering Cave data: data/altering-cave.json (community data; Team Méw credit retained in About)

Place a fresh dump at input/dump.zip and run UPDATE_FROM_DUMP.bat.
Run VALIDATE_DATA.bat before publishing.

Made from the PokeMMO Pokédex dump with AI usage by [MÜSH] PaulusPax.
Unofficial fan project; not affiliated with PokeMMO or its developers.
