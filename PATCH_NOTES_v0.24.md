# PaxDex v0.24 — context-aware shiny safety

## Added

- Rage Powder and Follow Me warnings for explicit hordes, natural hordes, Dark Grass doubles and non-Safari Lure doubles.
- Belly Drum, Teleport and Sticky Barb warnings.
- Smeargle/Sketch and Ditto/Transform PP/Struggle preparation notes.
- Setup-dependent Trick and Switcheroo warnings.
- Visible risk descriptions, affected levels and preparation advice in full encounter splits.
- `shared/safety-rules.json`, designed to be reusable by PaxDex and WARtool.

## Corrected

- Perish Song is excluded from horde-only encounters.
- Ghost Curse remains restricted to Ghost-type users.
- Head Smash advice now recommends Rock resistance rather than Ghost typing.
- Memento advice no longer implies that trapping prevents the move.
- Safari suppresses both safety and start-delay warnings.

## Deliberately excluded pending verification or missing context

- Dry Skin and Solar Power weather damage
- Healing Wish and Lunar Dance
- Roar, Whirlwind, Dragon Tail and Circle Throw
- Drifblim compound interactions
- Current Reactive Gas and Damp edge cases
