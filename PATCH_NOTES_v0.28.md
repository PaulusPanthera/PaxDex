# PaxDex v0.28 — Fishing modifiers, Fossils and Altering Cave

- Added **Fishing + Lure (340/hr)**, **Fishing + Chum Bucket (460/hr)** and **Fishing + Lure + Chum Bucket (470/hr)** as real hunt methods.
- Each modifier reuses the exact underlying Old Rod / Good Rod / Super Rod encounter split; only the encounter-pace assumption changes.
- Added **Fossil (530 revivals/hr)** as a real Shiny Hunter / Route Searcher method for the 9 directly revivable fossil species.
- Fossil revival tables are deterministic: the selected fossil species has a 100% target share.
- Added an **Altering Cave community rotation planner** to Routes using the supplied Team Méw data.
- The supplied sheet supports a strong current-pool inference: **Dark · Rotation 3**, because the sheet marks Dark ACTIVE and its Current summary exactly matches Dark Rotation 3.
- Added all 37 populated type/rotation groups from the supplied sheet (14 types currently contain rotation data).
- Altering Cave is intentionally excluded from encounters/hour rankings because the supplied sheets do not provide exact per-species encounter percentages.
- Added required Altering Cave source credit to About.
