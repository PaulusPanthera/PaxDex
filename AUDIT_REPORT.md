# PaxDex v0.28 Audit Report

## Result

PASS. v0.28 rebuilds from the 2026-08-06 dump and passes generated-data validation, JavaScript syntax and Python compilation.

## Generated data

- 649 Pokémon
- 80,796 hunt options
- 18,075 encounter tables
- 18,075 Route Searcher rows
- 2,145 ranked 5× training rows
- 395 maximum-yield EV rows

## Fishing modifiers

The original 1,437 fishing encounter tables remain separated by rod type:

- Old Rod: 297 tables
- Good Rod: 496 tables
- Super Rod: 644 tables

Each original table receives three additional hunt-mode views without altering species shares or the rod label:

- Fishing + Lure: 1,437 tables · 340/hr
- Fishing + Chum Bucket: 1,437 tables · 460/hr
- Fishing + Lure + Chum Bucket: 1,437 tables · 470/hr

The current dump contains no rod-specific Lure-only species entries, so these are modeled as encounter-speed modifiers over the same rod pools rather than new species compositions.

## Fossils

Nine directly revivable base species receive deterministic 100% Fossil hunt tables at 530 revivals/hour:

Omanyte, Kabuto, Aerodactyl, Lileep, Anorith, Cranidos, Shieldon, Tirtouga and Archen.

Evolved members remain searchable under the broader Pokédex Fossil family category, but do not incorrectly receive direct revival tables.

## Altering Cave

The supplied Rotation Groups sheet gives a strong current-state inference:

- Active type: Dark
- Current rotation: 3
- Current singles: Tyranitar, Solrock, Gothorita, Munna, Krookodile, Umbreon, Pawniard
- Current hordes: Nidorina, Scrafty
- Zorua: listed at 1% in all Dark hordes

The left-side Current summary exactly matches the Dark Rotation 3 block, which is why the planner defaults to Dark · Rotation 3.

The parsed source contains 37 populated rotation groups across 14 types. Fighting, Ghost and Ice currently have no populated rotation data in the supplied export.

The sheets describe pool membership but not exact encounter percentages. PaxDex therefore displays Altering Cave as an availability/rotation planner only and does not fabricate encounters/hour rankings.

Source credit retained as requested by the sheet: Team Méw · @rsslunar · @hekation · @kithri · @lorddusk.

## Checks

- `python scripts/build_data.py dump.zip .`: PASS
- `python scripts/validate_data.py`: PASS
- `node --check js/app.js`: PASS
- Python compilation: PASS
- 1,437/1,437 fishing tables reproduced for each modifier: PASS
- 9 deterministic Fossil tables: PASS
- Altering Cave Dark Rotation 3 source match: PASS
- Altering Cave ranking exclusion until rates are sourced: PASS

## Reproducibility

A second clean rebuild with the same 2026-08-06 dump was compared against the release output: **4,029 generated data/sprite files, 0 differences**. The static community `altering-cave.json` file is preserved across dump rebuilds.
