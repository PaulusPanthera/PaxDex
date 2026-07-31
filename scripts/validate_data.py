#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALID_SEASONS = {"Any", "Spring", "Summer", "Autumn", "Winter"}
VALID_TIMES = {"Morning", "Day", "Night"}
VALID_REGIONS = {"Kanto", "Hoenn", "Unova", "Sinnoh", "Johto"}
VALID_ENCOUNTER_TYPES = {"Grass", "Cave", "Sweet Scent", "Dark Grass", "Headbutt", "Inside", "Shadow", "Water", "Good Rod", "Super Rod", "Old Rod", "Fishing", "Rocks", "Honey Tree", "Dust Cloud"}
REQUIRED_HUNT_KEYS = {
    "region", "location", "encounterType", "method", "share", "minLevel",
    "maxLevel", "confidence", "note", "availability", "tableId"
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_option(pid: int, *, location: str, method: str, season: str, time: str):
    for opt in load(ROOT / "data" / "hunts" / f"{pid}.json"):
        if opt["location"] != location or opt["method"] != method:
            continue
        if any(a["season"] == season and a["time"] == time for a in opt["availability"]):
            return opt
    return None



def has_invalid_dump_decoration(value: object) -> bool:
    text = str(value or "")
    if any(ord(char) < 32 or ord(char) == 127 for char in text):
        return True
    first_ascii = next((index for index, char in enumerate(text) if char.isascii() and char.isalnum()), None)
    return first_ascii not in (None, 0)


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        index = load(ROOT / "data" / "index.json")
        methods = load(ROOT / "data" / "methods.json")
        build_info = load(ROOT / "data" / "build-info.json")
        encounter_tables = load(ROOT / "data" / "encounter-tables.json")
        phase_previews = load(ROOT / "data" / "phase-previews.json")
        safari_rates = load(ROOT / "data" / "safari-rates.json")
    except Exception as exc:
        print("VALIDATION FAILED")
        print(f"- Could not load core data: {exc}")
        return 1

    ids = [int(p["id"]) for p in index]
    if len(ids) != len(set(ids)):
        errors.append("Pokédex index contains duplicate Pokémon IDs.")
    if ids != sorted(ids):
        errors.append("Pokédex index is not sorted by Pokémon ID.")
    if int(build_info.get("pokemon", -1)) != len(index):
        errors.append(f"build-info Pokémon count is {build_info.get('pokemon')}, index contains {len(index)}.")
    for sprite_kind in ("icons", "icons-shiny", "normal", "shiny"):
        if int(build_info.get("sprites", {}).get(sprite_kind, -1)) != len(index):
            errors.append(f"build-info {sprite_kind} sprite count is {build_info.get('sprites', {}).get(sprite_kind)}, expected {len(index)}.")
    for p in index:
        pid = int(p["id"])
        line = [int(x) for x in p.get("evolutionLine", [pid])]
        root_id = int(p.get("evolutionRootId", pid))
        if pid not in line:
            errors.append(f"Compact index evolution line for #{pid} does not contain itself.")
        if root_id != min(line):
            errors.append(f"Compact index evolution root for #{pid} is {root_id}, expected {min(line)}.")
        if root_id not in ids:
            errors.append(f"Compact index evolution root for #{pid} references missing Pokémon #{root_id}.")

    method_ids = {m["id"] for m in methods}
    method_defaults = {m["id"]: float(m.get("defaultEph", 0)) for m in methods}
    if method_defaults.get("5× Horde") != 1200:
        errors.append("Default 5× Horde speed must be 1,200 encounters/hour.")
    if method_defaults.get("3× Horde") != 720:
        errors.append("Default 3× Horde speed must be 720 encounters/hour.")

    if int(build_info.get("encounterTables", -1)) != len(encounter_tables):
        errors.append(f"build-info table count is {build_info.get('encounterTables')}, generated table file contains {len(encounter_tables)}.")
    if set(phase_previews) != set(encounter_tables):
        errors.append("Phase-preview table IDs do not match the full encounter tables.")
    for table_id, table in encounter_tables.items():
        if table.get("region") not in VALID_REGIONS:
            errors.append(f"Encounter table {table_id} has invalid region {table.get('region')!r}.")
        if table.get("encounterType") not in VALID_ENCOUNTER_TYPES:
            errors.append(f"Encounter table {table_id} has invalid encounter type {table.get('encounterType')!r}.")
        components = table.get("components", [])
        if not components:
            errors.append(f"Encounter table {table_id} has no components.")
            continue
        total_share = sum(float(c.get("share", 0)) for c in components)
        if abs(total_share - 1.0) > 0.00001:
            errors.append(f"Encounter table {table_id} totals {total_share:.6f}, expected 1.0.")
        ids_in_table = [int(c.get("pokemonId", 0)) for c in components]
        if len(ids_in_table) != len(set(ids_in_table)):
            errors.append(f"Encounter table {table_id} contains duplicate Pokémon components.")
        expected_preview = [
            (int(c.get("pokemonId", 0)), c.get("name"), round(float(c.get("share", 0)), 7))
            for c in components
        ]
        actual_preview = [
            (int(c.get("pokemonId", 0)), c.get("name"), round(float(c.get("share", 0)), 7))
            for c in phase_previews.get(str(table_id), [])
        ]
        if actual_preview != expected_preview:
            errors.append(f"Phase preview {table_id} does not match its full encounter table.")
        for component in components:
            for ability in component.get("slowAbilities", []):
                if ability not in component.get("abilities", []):
                    errors.append(f"Encounter table {table_id} marks unknown slowdown ability {ability!r}.")
            capture = component.get("safariCapture")
            if capture and not (0 < float(capture.get("ballsOnlySuccess", 0)) <= 1):
                errors.append(f"Encounter table {table_id} has invalid Safari catch estimate.")
            for source in component.get("sources", []):
                if float(source.get("eventRate", 0)) <= 0 or int(source.get("count", 0)) <= 0:
                    errors.append(f"Encounter table {table_id} has an invalid encounter source.")
        shown_total = float(table.get("shownTableTotal", 0))
        if shown_total <= 0:
            errors.append(f"Encounter table {table_id} has no positive shown-Pokémon total.")
        if table.get("containsRandomHordes") and not any(
            source.get("kind") == "horde"
            for component in components
            for source in component.get("sources", [])
        ):
            errors.append(f"Encounter table {table_id} claims natural hordes but has no horde source.")

    if not safari_rates.get("johto") or not safari_rates.get("sinnoh"):
        errors.append("Safari rate source is missing Johto or Sinnoh entries.")

    gate_tables = [
        (table_id, table) for table_id, table in encounter_tables.items()
        if table.get("location") == "Safari Zone Gate"
    ]
    if not gate_tables:
        errors.append("Safari Zone Gate regression check failed: no encounter tables found.")
    for table_id, table in gate_tables:
        if table.get("safari") or table.get("method") in {"Safari", "Lure Safari"}:
            errors.append(f"Safari Zone Gate table {table_id} is incorrectly classified as Safari.")
        if table.get("method") != "Headbutt":
            errors.append(f"Safari Zone Gate table {table_id} should use Headbutt, got {table.get('method')!r}.")
        if any(component.get("safariCapture") for component in table.get("components", [])):
            errors.append(f"Safari Zone Gate table {table_id} incorrectly has Safari catch estimates.")

    # Hidden abilities cannot roll on ordinary wild encounters and must never create
    # a start-of-battle slowdown warning. Houndour/Houndoom's Unnerve is the
    # regression case; Growlithe's normal-slot Intimidate should still be marked.
    for hidden_pid in (228, 229):
        for table_id, table in encounter_tables.items():
            component = next((c for c in table.get("components", []) if int(c.get("pokemonId", -1)) == hidden_pid), None)
            if component and "Unnerve" in component.get("slowAbilities", []):
                errors.append(f"Hidden-ability regression failed: #{hidden_pid} has Unnerve slowdown in table {table_id}.")
    growlithe_slow = any(
        int(component.get("pokemonId", -1)) == 58 and "Intimidate" in component.get("slowAbilities", [])
        for table in encounter_tables.values()
        for component in table.get("components", [])
    )
    if not growlithe_slow:
        errors.append("Normal-ability slowdown regression failed: Growlithe Intimidate is not marked.")

    hunt_count = 0
    held_item_ids: set[int] = set()
    confidence_counts = {"High": 0, "Medium": 0, "Low": 0}
    for p in index:
        pid = int(p["id"])
        detail_path = ROOT / "data" / "pokemon" / f"{pid}.json"
        hunts_path = ROOT / "data" / "hunts" / f"{pid}.json"
        if not detail_path.exists():
            errors.append(f"Missing Pokémon detail JSON for #{pid} {p.get('name', '')}.")
            continue
        if not hunts_path.exists():
            errors.append(f"Missing hunt JSON for #{pid} {p.get('name', '')}.")
            continue
        try:
            detail = load(detail_path)
            hunts = load(hunts_path)
        except Exception as exc:
            errors.append(f"Invalid JSON for #{pid}: {exc}")
            continue
        if int(detail.get("id", -1)) != pid:
            errors.append(f"Detail ID mismatch for #{pid}.")
        if len(detail.get("types", [])) != len(set(detail.get("types", []))):
            errors.append(f"Duplicate display types remain for #{pid} {p.get('name', '')}.")
        for item in detail.get("heldItems", []):
            if has_invalid_dump_decoration(item.get("name")):
                errors.append(f"Decorated or invalid held-item label remains for #{pid}: {item.get('name')!r}.")
            if item.get("id") is not None:
                item_id = int(item["id"]); held_item_ids.add(item_id)
                if not (ROOT / "sprites" / "items" / f"{item_id}.png").exists():
                    errors.append(f"Missing item icon #{item_id} used by #{pid} {p.get('name', '')}.")
        for evolution in detail.get("evolutions", []):
            if evolution.get("item_name") and has_invalid_dump_decoration(evolution.get("item_name")):
                errors.append(f"Decorated or invalid evolution-item label remains for #{pid}: {evolution.get('item_name')!r}.")
        listed_methods = p.get("methods", [])
        if len(listed_methods) != len(set(listed_methods)):
            errors.append(f"Duplicate hunt methods remain in the compact index for #{pid}.")
        for listed_method in listed_methods:
            if listed_method not in method_ids:
                errors.append(f"Compact index for #{pid} uses unknown method {listed_method!r}.")

        compact_availability = p.get("methodAvailability", {})
        if set(compact_availability) != set(listed_methods):
            errors.append(f"Compact availability methods for #{pid} do not match its listed hunt methods.")
        expected_availability: dict[str, set[tuple[str, str]]] = {}
        for hunt in hunts:
            expected_availability.setdefault(hunt["method"], set()).update(
                (pair["season"], pair["time"]) for pair in hunt.get("availability", [])
            )
        for method, pairs in compact_availability.items():
            actual_pairs = {(pair.get("season"), pair.get("time")) for pair in pairs}
            if len(actual_pairs) != len(pairs):
                errors.append(f"Compact availability for #{pid} {method} contains duplicate pairs.")
            for season, time in actual_pairs:
                if season not in VALID_SEASONS or time not in VALID_TIMES:
                    errors.append(f"Compact availability for #{pid} {method} contains invalid {season!r}/{time!r}.")
            if actual_pairs != expected_availability.get(method, set()):
                errors.append(f"Compact availability for #{pid} {method} does not match detailed hunts.")

        for folder in ("normal", "shiny", "icons", "icons-shiny"):
            if not (ROOT / "sprites" / folder / f"{pid}.png").exists():
                errors.append(f"Missing {folder} sprite for #{pid} {p.get('name', '')}.")

        hunt_count += len(hunts)
        for n, h in enumerate(hunts, 1):
            missing = REQUIRED_HUNT_KEYS - set(h)
            if missing:
                errors.append(f"#{pid} hunt {n} is missing keys: {', '.join(sorted(missing))}.")
                continue
            if h["method"] not in method_ids:
                errors.append(f"#{pid} hunt {n} uses unknown method {h['method']!r}.")
            share = float(h["share"])
            if not (0 < share <= 1.000001):
                errors.append(f"Invalid share for #{pid} {p.get('name', '')}: {share}.")
            table = encounter_tables.get(str(h.get("tableId")))
            if table is None:
                errors.append(f"#{pid} hunt {n} references missing encounter table {h.get('tableId')!r}.")
            else:
                component = next((c for c in table.get("components", []) if int(c.get("pokemonId", -1)) == pid), None)
                if component is None:
                    errors.append(f"#{pid} hunt {n} is absent from its encounter table {h.get('tableId')}.")
                elif abs(float(component.get("share", 0)) - share) > 0.000001:
                    errors.append(f"#{pid} hunt {n} share differs from encounter table {h.get('tableId')}.")
            confidence = h.get("confidence")
            if confidence not in confidence_counts:
                errors.append(f"Invalid confidence for #{pid}: {confidence!r}.")
            else:
                confidence_counts[confidence] += 1
            pairs = []
            for a in h.get("availability", []):
                season, time = a.get("season"), a.get("time")
                if season not in VALID_SEASONS:
                    errors.append(f"Invalid season for #{pid}: {season!r}.")
                if time not in VALID_TIMES:
                    errors.append(f"Invalid time for #{pid}: {time!r}.")
                pairs.append((season, time))
            if not pairs:
                errors.append(f"#{pid} hunt {n} has no availability entries.")
            if len(pairs) != len(set(pairs)):
                errors.append(f"#{pid} hunt {n} contains duplicate availability entries.")


    route_index_path = ROOT / "data" / "route-index.json"
    if not route_index_path.exists():
        errors.append("Missing data/route-index.json.")
        route_index = []
    else:
        try:
            route_index = json.loads(route_index_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"Invalid route-index.json: {exc}")
            route_index = []
    valid_table_ids = set(encounter_tables)
    for n, row in enumerate(route_index, 1):
        if str(row.get("tableId")) not in valid_table_ids:
            errors.append(f"Route index row {n} references missing table {row.get('tableId')!r}.")
        if not row.get("region") or not row.get("location") or not row.get("method"):
            errors.append(f"Route index row {n} is missing region, location or method.")
        if row.get("region") not in VALID_REGIONS:
            errors.append(f"Route index row {n} has invalid region {row.get('region')!r}.")
        if row.get("encounterType") not in VALID_ENCOUNTER_TYPES:
            errors.append(f"Route index row {n} has invalid encounter type {row.get('encounterType')!r}.")
        if not row.get("availability"):
            errors.append(f"Route index row {n} has no availability data.")
    if int(build_info.get("routeTables", -1)) != len(route_index):
        errors.append(f"build-info route table count is {build_info.get('routeTables')}, route index contains {len(route_index)}.")
    for n, row in enumerate(route_index, 1):
        if row.get("location") == "Safari Zone Gate" and (row.get("safari") or row.get("method") in {"Safari", "Lure Safari"}):
            errors.append(f"Route index row {n} incorrectly classifies Safari Zone Gate as Safari.")

    if int(build_info.get("huntOptions", -1)) != hunt_count:
        errors.append(f"build-info hunt count is {build_info.get('huntOptions')}, generated files contain {hunt_count}.")
    if int(build_info.get("itemSprites", -1)) != len(held_item_ids):
        errors.append(f"build-info item sprite count is {build_info.get('itemSprites')}, expected {len(held_item_ids)} held-item icons.")

    bulba = find_option(1, location="Viridian Forest", method="Lure Singles", season="Spring", time="Morning")
    if not bulba:
        errors.append("Bulbasaur Lure validation failed (missing Viridian Forest option).")
    else:
        bulba_table = encounter_tables.get(str(bulba.get("tableId")), {})
        bulba_component = next((c for c in bulba_table.get("components", []) if int(c.get("pokemonId", -1)) == 1), None)
        lure_event_rate = sum(float(src.get("eventRate", 0)) for src in (bulba_component or {}).get("sources", []) if src.get("kind") == "lure")
        if abs(lure_event_rate - 0.05) > 0.00001:
            errors.append("Bulbasaur Lure validation failed (expected a 5% lure-exclusive encounter roll).")

    expected = {168: 0.4, 313: 0.3, 314: 0.3}
    route_table_ids = set()
    for pid, share in expected.items():
        opt = find_option(pid, location="Route 229", method="5× Horde", season="Autumn", time="Night")
        if not opt or abs(float(opt["share"]) - share) > 0.0001:
            errors.append(f"Route 229 Sweet Scent validation failed for #{pid}; expected {share:.0%}.")
        elif opt:
            route_table_ids.add(str(opt["tableId"]))
    if len(route_table_ids) != 1:
        errors.append("Route 229 target species do not reference the same full encounter split.")

    route229_single = find_option(168, location="Route 229", method="Singles", season="Autumn", time="Night")
    if not route229_single:
        errors.append("Route 229 Singles validation failed (Ariados option missing).")
    else:
        mixed_table = encounter_tables.get(str(route229_single.get("tableId")), {})
        mixed_component = next((c for c in mixed_table.get("components", []) if int(c.get("pokemonId", -1)) == 168), None)
        if not mixed_table.get("containsRandomHordes"):
            errors.append("Route 229 Singles does not include the natural horde roll.")
        if not any(src.get("kind") == "horde" for src in (mixed_component or {}).get("sources", [])):
            errors.append("Route 229 Ariados Singles component is missing its natural horde contribution.")
        if abs(float(mixed_table.get("rawTableTotal", 0)) - 1.0) > 0.0001:
            errors.append("Route 229 Singles encounter rolls do not total 100%.")

    route229_lure = find_option(168, location="Route 229", method="Lure Singles", season="Autumn", time="Night")
    if route229_lure:
        lure_table = encounter_tables.get(str(route229_lure.get("tableId")), {})
        if not lure_table.get("containsRandomHordes"):
            errors.append("Route 229 Lure Singles does not preserve the natural horde roll.")

    route32_lure = find_option(158, location="Route 32", method="Lure Singles", season="Summer", time="Morning")
    if not route32_lure:
        errors.append("Route 32 Lure validation failed (Totodile option missing).")
    else:
        route32_table = encounter_tables.get(str(route32_lure.get("tableId")), {})
        all_sources = [source for component in route32_table.get("components", []) for source in component.get("sources", [])]
        lure_total = sum(float(source.get("eventRate", 0)) for source in all_sources if source.get("kind") == "lure")
        base_total = sum(float(source.get("eventRate", 0)) for source in all_sources if source.get("kind") != "lure")
        if abs(base_total - 0.95) > 0.00001 or abs(lure_total - 0.05) > 0.00001:
            errors.append(f"Route 32 Lure table must be 95% scaled base outcomes + 5% lure outcome, got {base_total:.4f} + {lure_total:.4f}.")
        if abs(float(route32_table.get("rawTableTotal", 0)) - 1.0) > 0.00001:
            errors.append("Route 32 Lure encounter outcomes do not total 100%.")
        if abs(float(route32_table.get("shownTableTotal", 0)) - 1.095) > 0.00001:
            errors.append("Route 32 Lure shown-Pokémon total should be 1.095 per encounter roll.")

    if not any(c.get("slowAbilities") for table in encounter_tables.values() for c in table.get("components", [])):
        errors.append("No start-of-battle slowdown abilities were generated.")
    if not any(c.get("safariCapture") for table in encounter_tables.values() for c in table.get("components", [])):
        errors.append("No Safari catch estimates were attached to encounter tables.")

    if errors:
        print("VALIDATION FAILED")
        for error in errors[:100]:
            print("-", error)
        if len(errors) > 100:
            print(f"- …and {len(errors) - 100} more errors")
        return 1

    print("VALIDATION PASSED")
    print(f"- {len(index)} Pokédex entries and {hunt_count:,} hunt options loaded")
    print(f"- All Pokémon detail, hunt and sprite files are present, including {len(held_item_ids)} held-item icons")
    print("- Evolution roots, regions, encounter labels, methods, shares, seasons, times, table references and confidence values are valid")
    print("- No control characters or decorated dump prefixes leaked into published labels")
    print(f"- {len(encounter_tables):,} full encounter tables and {len(route_index):,} route-search rows validated")
    print("- Start-of-battle slowdown indicators and Safari catch estimates are present")
    print("- Safari Zone Gate is correctly classified as Headbutt, not Safari")
    print("- Bulbasaur Lure-exclusive encounter roll = 5%")
    print("- Route 229 Autumn Night 5× Horde = Ariados 40%, Volbeat 30%, Illumise 30%")
    print("- Natural 5% horde blocks are included in Singles and Lure Singles, then extracted separately for Sweet Scent")
    print("- Route 32 Lure table = 95% scaled base outcomes + 5% lure-exclusive outcome; 1.095 Pokémon shown per roll")
    print("- Default horde speeds = 1,200 / 720 encounters per hour")
    print(f"- Confidence totals: High {confidence_counts['High']:,}, Medium {confidence_counts['Medium']:,}, Low {confidence_counts['Low']:,}")
    if warnings:
        print("WARNINGS")
        for warning in warnings:
            print("-", warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
