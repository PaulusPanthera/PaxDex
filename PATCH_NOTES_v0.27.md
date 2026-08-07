# PaxDex v0.27 — Encounter pace defaults

- Adopted the current working encounter-per-hour assumptions used for planning.
- Standard 5× Horde: **1,200/hr**; slowdown-adjusted 5× Horde: **1,100/hr**.
- Standard 3× Horde: **720/hr**; slowdown-adjusted 3× Horde: **660/hr**.
- Horde hunt rankings, route cards and encounter splits automatically use the slowed value when a possible start-of-battle ability delay exists.
- Lure Singles: **280/hr**.
- Singles and Surfing: **220/hr**.
- Safari and Lure Safari: **300/hr**.
- Old Rod, Good Rod and Super Rod: **270/hr each**.
- Rock Smash and Headbutt: **120/hr**.
- Honey Tree: **250/hr**, counting active encounter time only and excluding waiting.
- Existing custom settings are preserved where possible; the old Honey Tree default of 0 migrates to 250.
- The supplied **Fishing + Lure (340)**, **Fishing + Chum Bucket (460)**, **Fishing + Lure + Chum Bucket (470)** and **Fossil (530)** assumptions are retained as future working values, but are not applied to rankings yet because PaxDex does not currently model those modifier modes as distinct hunt methods.
