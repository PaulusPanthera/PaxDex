# PaxDex v0.29 Audit Report

## Result

**PASS.** v0.29 keeps the v0.28 encounter/fishing/fossil dataset intact and changes the Altering Cave presentation/model only.

## Requested UI changes

- Route Searcher cascade now renders before the Altering Cave community panel: **PASS**
- No Altering Cave set is labelled `ACTIVE`, `current`, or `Current sheet pool`: **PASS**
- Observed source sets are labelled as observed rotations rather than a live feed: **PASS**
- Team Méw source credit retained: **PASS**

## Altering Cave RNG inference

The supplied `Pools.csv` and `Rotation Groups.csv` support a useful **experimental composition model**, but not a next-day predictor.

Across the 37 populated observed rotation sets:

- 27 / 37 exactly match the current source-pool recipe
- Singles: **5 species from the common-single pool + 2 species from the selected type's Rare/Lure pool**
- Hordes: **1 species from the common-horde pool + 1 species from the selected type's horde pool**
- Dark additionally lists **Zorua at 1% in all Dark hordes**; the simulator treats that as an extra slot rather than one of the two main horde species.

The ten non-matching historical/observed sets contain species absent from the current `Pools.csv` lists. This means the source appears to have evolved over time or contains incomplete/stale pool membership, so the model is deliberately labelled experimental.

### Simulator safeguards

- The player manually chooses the type pool; PaxDex does **not** assume how the daily type is selected.
- The simulator samples without duplicate species in a generated singles/horde set.
- Duplicate spreadsheet rows are not interpreted as proven probability weights.
- The generated roll is labelled a **possible** pool, not tomorrow's or the current pool.
- Exact encounter percentages remain unknown and Altering Cave stays excluded from encounters/hour rankings.
- All 14 type pools with observed rotation data have enough current pool data to generate the inferred 5+2 / 1+1 composition.

## Existing dataset regression

- 649 Pokémon: **PASS**
- 80,796 hunt options: **PASS**
- 18,075 encounter tables / Route Searcher rows: **PASS**
- 2,145 5× training rows: **PASS**
- 395 maximum-yield EV rows: **PASS**
- Fishing modifiers and 9 deterministic fossil tables: **PASS**
- Safari and shiny-safety validation: **PASS**

## Static checks

- JavaScript syntax: **PASS**
- Python compilation: **PASS**
- Full generated-data validator: **PASS**
- Altering Cave RNG recipe/evidence validation: **PASS**

## Interpretation

The data is strong enough for a **daily-roll simulator** and for cataloguing observed rotations. It is **not yet strong enough to infer a PRNG seed, deterministic sequence, rotation order, daily type probability, or exact encounter percentages**. Those would require timestamped observations over many consecutive in-game days.
