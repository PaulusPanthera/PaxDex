# PaxDex v0.26 — Hunter URLs, evolution families and rod separation

## Readable Shiny Hunter links

- Shiny Hunter pages now use editable name-based URLs such as `#hunter/pikachu`.
- Old numeric links such as `#hunter/25` remain supported and automatically normalize to the readable URL.
- Evolution-line mode also normalizes the URL to the real base form, for example Pikachu's family becomes `#hunter/pichu`.
- Pokédex buttons, hunt previews, favorites and the Pokémon picker now all generate readable Hunter links.

## Correct evolution families

- Evolution roots are now derived from the actual directed evolution graph instead of the lowest National Pokédex number.
- Baby Pokémon introduced in later generations now correctly lead their families, including Pichu, Cleffa, Igglybuff, Tyrogue, Happiny, Mime Jr., Munchlax and Budew.
- Family members are ordered by actual evolution stage.
- Branching families are displayed as stages rather than as one misleading linear chain.
- Corrected 47 Pokémon entries across 17 affected families.

## Rod-specific fishing

- Old Rod, Good Rod and Super Rod are now separate methods throughout PaxDex.
- Shiny Hunter rankings, Route Searcher filters and encounter-speed settings can now treat each rod independently.
- The Pokédex includes both a broad **Fishing · Any Rod** filter and separate filters for each rod.
- Safari fishing tables retain their Safari catch rules while using their actual rod method.
- Existing customized Fishing speed is copied to all three rod settings during the one-time settings migration.

## Deployment reliability

- GitHub Pages artifacts now use the workflow-attempt number for both upload and deployment.
- Re-running a workflow no longer produces two artifacts with the same `github-pages` name.

## Data totals

- 649 Pokémon
- 66,834 hunt options
- 13,755 encounter tables / Route Searcher rows
- 2,145 ranked 5× training rows
- 395 maximum-yield EV rows
