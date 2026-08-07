# PaxDex v0.27 Audit Report

## Result

PASS. The v0.27 encounter-pace patch rebuilds cleanly from the 2026-08-06 dump and passes the complete generated-data validator, JavaScript syntax, Python compilation and workflow-YAML parsing.

## Data

- 649 Pokémon
- 66,834 hunt options
- 13,755 full encounter tables
- 13,755 Route Searcher rows
- 2,145 ranked 5× training rows
- 395 maximum-yield EV rows

## Working encounter-pace defaults

- 5× Horde: 1,200 Pokémon/hour
- 5× Horde with possible start-of-battle slowdown: 1,100/hour
- 3× Horde: 720/hour
- 3× Horde with possible start-of-battle slowdown: 660/hour
- Lure Singles: 280/hour
- Singles: 220/hour
- Surfing: 220/hour
- Safari: 300/hour
- Lure Safari: 300/hour
- Old Rod: 270/hour
- Good Rod: 270/hour
- Super Rod: 270/hour
- Rock Smash: 120/hour
- Headbutt: 120/hour
- Honey Tree: 250/hour, active encounter time only; waiting excluded

## Slowdown integration

- Generated hunt and Route Searcher rows now carry a `hasSlowdown` flag derived from the encounter table's normal wild ability slots.
- 5× and 3× Horde rankings automatically switch to the slowed pace when that flag is present.
- Full encounter splits use the same adjusted speed.
- Route Searcher displays the adjusted pace on affected cards and a range when one filtered location contains both normal and slowed tables.
- Safari continues to suppress slowdown warnings and therefore does not trigger the slowed-Horde pace.

## Settings migration

- Settings schema bumped to v7.
- Existing custom encounter speeds are retained.
- Honey Tree values at the former built-in default of 0 migrate to 250.
- New slowed Horde fields default to 1,100 / 660 and remain editable.

## Reference values not yet active

The supplied planning sheet also contains Fishing + Lure 340, Fishing + Chum Bucket 460, Fishing + Lure + Chum Bucket 470 and Fossil 530. Those values are documented in the v0.27 notes but are not used in rankings yet because PaxDex does not currently model those modifiers as separate hunt methods. Applying them to unrelated rod/fossil data would produce misleading rankings.

## Checks

- `python scripts/build_data.py dump.zip .`: PASS
- `python scripts/validate_data.py`: PASS
- `node --check js/app.js`: PASS
- `python -m compileall scripts`: PASS
- Workflow YAML parse: PASS
- Default pace assertions: PASS
- Slowdown flag propagation across encounter tables and route rows: PASS
