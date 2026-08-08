#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALID_SEASONS = {"Any", "Spring", "Summer", "Autumn", "Winter"}
VALID_TIMES = {"Morning", "Day", "Night"}
VALID_REGIONS = {"Kanto", "Hoenn", "Unova", "Sinnoh", "Johto", "Global"}
VALID_ENCOUNTER_TYPES = {"Grass", "Cave", "Sweet Scent", "Dark Grass", "Headbutt", "Inside", "Shadow", "Water", "Good Rod", "Super Rod", "Old Rod", "Fishing", "Rocks", "Honey Tree", "Dust Cloud", "Fossil"}
REQUIRED_HUNT_KEYS = {
    "region", "location", "encounterType", "method", "share", "minLevel",
    "maxLevel", "confidence", "note", "availability", "tableId"
}

FOSSIL_SPECIES = {
    138, 139, 140, 141, 142,
    345, 346, 347, 348,
    408, 409, 410, 411,
    564, 565, 566, 567,
}

JOHTO_SAFARI_AREAS = {
    343: "Plains", 344: "Meadow", 345: "Savannah", 346: "Peak",
    347: "Rocky Beach", 348: "Wetland", 349: "Forest", 350: "Swamp",
    351: "Marshland", 352: "Wasteland", 353: "Mountain", 354: "Desert",
}
HOENN_SAFARI_LABELS = {
    844: "Safari Zone — South Area (Area 1)",
    588: "Safari Zone — Southwest Area (Area 2)",
    76: "Safari Zone — Northwest Area (Area 3)",
    332: "Safari Zone — North Area (Area 4)",
    3404: "Safari Zone — Southeast Area (Area 5)",
    3148: "Safari Zone — Northeast Area (Area 6)",
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


def has_option(pid: int, *, region: str, location: str, method: str) -> bool:
    return any(
        opt.get("region") == region and opt.get("location") == location and opt.get("method") == method
        for opt in load(ROOT / "data" / "hunts" / f"{pid}.json")
    )



def has_invalid_dump_decoration(value: object) -> bool:
    text = str(value or "")
    if any(ord(char) < 32 or ord(char) == 127 for char in text):
        return True
    first_ascii = next((index for index, char in enumerate(text) if char.isascii() and char.isalnum()), None)
    return first_ascii not in (None, 0)


def semantic_categories_for(pid: int, hunt: dict, table: dict) -> list[str]:
    component = next((row for row in table.get("components", []) if int(row.get("pokemonId", -1)) == pid), None)
    if component is None:
        return []
    source_kinds = {str(source.get("kind", "")) for source in component.get("sources", [])}
    method = str(hunt.get("method", ""))
    categories: list[str] = []
    if method in {"Lure Singles", "Lure Safari"}:
        categories.append("Lure")
    if hunt.get("safari"):
        categories.append("Safari")
    if method in {"5× Horde", "3× Horde"}:
        pure = len(table.get("components", [])) == 1 and abs(float(component.get("share", 0)) - 1.0) <= 0.000001
        categories.append(f"{method} · {'100%' if pure else 'Split'}")
    elif method in {"Singles", "Surfing"}:
        if "single" in source_kinds:
            categories.append(method)
    elif method in {"Old Rod", "Good Rod", "Super Rod"}:
        categories.extend(["Fishing", method])
    elif method in {"Fishing + Lure", "Fishing + Chum Bucket", "Fishing + Lure + Chum Bucket"}:
        categories.extend(["Fishing", method])
    elif method in {"Fishing", "Rock Smash", "Headbutt", "Honey Tree", "Special", "Fossil"}:
        categories.append(method)
    return categories


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        index = load(ROOT / "data" / "index.json")
        methods = load(ROOT / "data" / "methods.json")
        dex_categories = load(ROOT / "data" / "dex-categories.json")
        build_info = load(ROOT / "data" / "build-info.json")
        encounter_tables = load(ROOT / "data" / "encounter-tables.json")
        phase_previews = load(ROOT / "data" / "phase-previews.json")
        training_index = load(ROOT / "data" / "training-index.json")
        safari_rates = load(ROOT / "data" / "safari-rates.json")
        safety_rules = load(ROOT / "data" / "safety-rules.json")
        altering_cave = load(ROOT / "data" / "altering-cave.json")
    except Exception as exc:
        print("VALIDATION FAILED")
        print(f"- Could not load core data: {exc}")
        return 1

    shared_safety_path = ROOT / "shared" / "safety-rules.json"
    if not shared_safety_path.exists():
        errors.append("Missing shared/safety-rules.json.")
    else:
        try:
            shared_safety_rules = load(shared_safety_path)
            if shared_safety_rules != safety_rules:
                errors.append("Generated safety-rules.json differs from the shared source rules.")
        except Exception as exc:
            errors.append(f"Invalid shared safety rules: {exc}")
    if not safety_rules.get("rules") or int(safety_rules.get("schemaVersion", 0)) < 1:
        errors.append("Safety rules are missing or use an invalid schema version.")

    app_source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
    for required in ("function hunterPath(", "function hunterHref(", "resolvePokemonRoute(arg)", "evo-family-stages", "settingsVersion: 8"):
        if required not in app_source:
            errors.append(f"Application regression: missing {required!r}.")
    if '#hunter/${id}' in app_source or 'go(`hunter/${' in app_source:
        errors.append("Application regression: a numeric Shiny Hunter URL template remains.")

    workflow_path = ROOT / ".github" / "workflows" / "pages.yml"
    if workflow_path.exists():
        workflow_source = workflow_path.read_text(encoding="utf-8")
        attempt_name = "github-pages-${{ github.run_attempt }}"
        if workflow_source.count(attempt_name) < 2:
            errors.append("Pages workflow does not use a matching run-attempt-specific artifact name for upload and deploy.")

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
    detail_cache = {pid: load(ROOT / "data" / "pokemon" / f"{pid}.json") for pid in ids}
    parent_map: dict[int, set[int]] = {pid: set() for pid in ids}
    for parent_id, detail in detail_cache.items():
        for evolution in detail.get("evolutions", []):
            child_id = int(evolution.get("id", 0) or 0)
            if child_id in parent_map:
                parent_map[child_id].add(parent_id)
    for p in index:
        pid = int(p["id"])
        line = [int(x) for x in p.get("evolutionLine", [pid])]
        root_id = int(p.get("evolutionRootId", pid))
        if pid not in line:
            errors.append(f"Compact index evolution line for #{pid} does not contain itself.")
        if not line or root_id != line[0]:
            errors.append(f"Compact index evolution root/order mismatch for #{pid}: root {root_id}, line {line}.")
        if root_id not in ids:
            errors.append(f"Compact index evolution root for #{pid} references missing Pokémon #{root_id}.")
        if parent_map.get(root_id, set()).intersection(line):
            errors.append(f"Evolution root #{root_id} for family containing #{pid} has an in-family parent.")
        detail = detail_cache[pid]
        if [int(x) for x in detail.get("evolutionLine", [])] != line:
            errors.append(f"Detail/index evolution line mismatch for #{pid}.")
        if int(detail.get("evolutionRootId", pid)) != root_id:
            errors.append(f"Detail/index evolution root mismatch for #{pid}.")
        stages = [[int(x) for x in stage] for stage in detail.get("evolutionStages", [])]
        if not stages or [member for stage in stages for member in stage] != line:
            errors.append(f"Evolution stages do not flatten to the ordered line for #{pid}.")

    method_ids = {m["id"] for m in methods}
    method_defaults = {m["id"]: float(m.get("defaultEph", 0)) for m in methods}
    category_ids = [row.get("id") for row in dex_categories]
    if len(category_ids) != len(set(category_ids)) or not all(category_ids):
        errors.append("Pokédex encounter categories contain duplicate or empty IDs.")
    required_categories = {"Lure", "Lure-exclusive", "Safari", "Special", "Fossil", "5× Horde · 100%", "5× Horde · Split", "3× Horde · 100%", "3× Horde · Split", "Singles", "Surfing", "Fishing", "Old Rod", "Good Rod", "Super Rod", "Fishing + Lure", "Fishing + Chum Bucket", "Fishing + Lure + Chum Bucket", "Fossil"}
    if not required_categories.issubset(set(category_ids)):
        errors.append("Pokédex encounter categories are missing required semantic filters.")

    by_id = {int(row["id"]): row for row in index}
    bulbasaur_categories = set(by_id.get(1, {}).get("dexCategories", []))
    caterpie_categories = set(by_id.get(10, {}).get("dexCategories", []))
    audino_categories = set(by_id.get(531, {}).get("dexCategories", []))
    if not {"Lure", "Lure-exclusive"}.issubset(bulbasaur_categories):
        errors.append("Lure-category regression failed: Bulbasaur must be Lure and Lure-exclusive.")
    if "Lure" not in caterpie_categories or "Lure-exclusive" in caterpie_categories:
        errors.append("Lure-category regression failed: Caterpie must be Lure but not Lure-exclusive.")
    if "Special" not in audino_categories:
        errors.append("Special-category regression failed: Audino phenomenon encounters are missing.")
    for fossil_id in FOSSIL_SPECIES:
        if "Fossil" not in set(by_id.get(fossil_id, {}).get("dexCategories", [])):
            errors.append(f"Fossil-category regression failed for Pokémon #{fossil_id}.")
    for row in index:
        labels = set(row.get("dexCategories", []))
        searchable = set(row.get("dexSearchCategories", []))
        for size in (3, 5):
            pure = f"{size}× Horde · 100%"
            split = f"{size}× Horde · Split"
            if pure in labels and split in searchable:
                errors.append(f"Split-priority regression failed for #{row.get('id')} at {size}× Horde.")

    if method_defaults.get("5× Horde") != 1200:
        errors.append("Default 5× Horde speed must be 1,200 encounters/hour.")
    if method_defaults.get("3× Horde") != 720:
        errors.append("Default 3× Horde speed must be 720 encounters/hour.")
    for rod in ("Old Rod", "Good Rod", "Super Rod"):
        if rod not in method_ids:
            errors.append(f"Missing rod-specific method: {rod}.")
        if method_defaults.get(rod) != 270:
            errors.append(f"Default {rod} speed must be 270 encounters/hour until separately measured.")

    expected_family_roots = {25: 172, 35: 173, 106: 236, 107: 236, 122: 439, 143: 446, 242: 440}
    for member_id, expected_root in expected_family_roots.items():
        actual = int(by_id.get(member_id, {}).get("evolutionRootId", -1))
        if actual != expected_root:
            errors.append(f"Evolution-root regression failed for #{member_id}: got #{actual}, expected #{expected_root}.")

    if int(build_info.get("encounterTables", -1)) != len(encounter_tables):
        errors.append(f"build-info table count is {build_info.get('encounterTables')}, generated table file contains {len(encounter_tables)}.")
    if set(phase_previews) != set(encounter_tables):
        errors.append("Phase-preview table IDs do not match the full encounter tables.")
    for table_id, table in encounter_tables.items():
        encounter_type = str(table.get("encounterType", ""))
        method = str(table.get("method", ""))
        fishing_modifiers = {"Fishing + Lure", "Fishing + Chum Bucket", "Fishing + Lure + Chum Bucket"}
        if encounter_type in {"Old Rod", "Good Rod", "Super Rod"} and method not in ({encounter_type} | fishing_modifiers):
            errors.append(f"Rod separation failed for table {table_id}: {encounter_type} became {method}.")
        if encounter_type == "Fishing" and method not in ({"Fishing"} | fishing_modifiers):
            errors.append(f"Unspecified Fishing table {table_id} has unexpected method {method}.")
        if encounter_type == "Fossil" and method != "Fossil":
            errors.append(f"Fossil table {table_id} has unexpected method {method}.")
        if table.get("region") not in VALID_REGIONS:
            errors.append(f"Encounter table {table_id} has invalid region {table.get('region')!r}.")
        if table.get("encounterType") not in VALID_ENCOUNTER_TYPES:
            errors.append(f"Encounter table {table_id} has invalid encounter type {table.get('encounterType')!r}.")
        if table.get("safari"):
            if table.get("safetyWarningsApplicable") is not False:
                errors.append(f"Safari encounter table {table_id} must suppress safety warnings in Safari contexts.")
            if table.get("slowdownWarningsApplicable") is not False:
                errors.append(f"Safari encounter table {table_id} must suppress start-delay warnings in Safari contexts.")
            pool = table.get("safariPool") or {}
            if not pool.get("status") or not pool.get("label"):
                errors.append(f"Safari encounter table {table_id} is missing source-coverage metadata.")
            if table.get("region") == "Johto" and table.get("encounterType") == "Grass":
                if pool.get("status") != "partial" or abs(float(pool.get("documentedTotal", 0)) - 0.9) > 0.00001:
                    errors.append(f"Johto Safari grass table {table_id} must be labelled as a 90% documented base pool.")
            if table.get("region") == "Sinnoh" and table.get("encounterType") == "Grass":
                if pool.get("status") != "partial" or abs(float(pool.get("documentedTotal", 0)) - 0.8) > 0.00001:
                    errors.append(f"Sinnoh Great Marsh grass table {table_id} must be labelled as an 80% documented base pool.")
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
            (int(c.get("pokemonId", 0)), c.get("name"), round(float(c.get("share", 0)), 7), c.get("safetyRisks", []))
            for c in components
        ]
        actual_preview = [
            (int(c.get("pokemonId", 0)), c.get("name"), round(float(c.get("share", 0)), 7), c.get("safetyRisks", []))
            for c in phase_previews.get(str(table_id), [])
        ]
        if actual_preview != expected_preview:
            errors.append(f"Phase preview {table_id} does not match its full encounter table.")
        for component in components:
            for ability in component.get("slowAbilities", []):
                if ability not in component.get("abilities", []):
                    errors.append(f"Encounter table {table_id} marks unknown slowdown ability {ability!r}.")
            risk_keys = set()
            risks = component.get("safetyRisks", [])
            if table.get("safari") and risks:
                errors.append(f"Safari encounter table {table_id} contains active safety warnings for #{component.get('pokemonId')}.")
            source_kinds = {str(source.get("kind", "")) for source in component.get("sources", [])}
            explicit_horde = table.get("method") in {"5× Horde", "3× Horde"}
            horde_source = explicit_horde or bool(source_kinds & {"horde", "sweet-scent"})
            single_source = bool(source_kinds & {"single", "lure"})
            lure_double = table.get("method") == "Lure Singles" and not table.get("safari")
            dark_grass_double = table.get("encounterType") == "Dark Grass" and not table.get("safari")
            multiple_opponents = horde_source or lure_double or dark_grass_double
            horde_only = explicit_horde or (horde_source and not single_source and not lure_double and not dark_grass_double)
            for risk in risks:
                key = (risk.get("kind"), risk.get("name"))
                if key in risk_keys:
                    errors.append(f"Encounter table {table_id} contains duplicate safety risk {key!r}.")
                risk_keys.add(key)
                if risk.get("kind") not in {"move", "ability", "held-item", "compound"}:
                    errors.append(f"Encounter table {table_id} contains an invalid safety-risk kind: {risk!r}.")
                if risk.get("severity") not in {"critical", "warning", "preparation"}:
                    errors.append(f"Encounter table {table_id} contains an invalid safety severity: {risk!r}.")
                if not all(risk.get(field) for field in ("name", "category", "description", "preparation", "verification")):
                    errors.append(f"Encounter table {table_id} contains an incomplete safety risk entry: {risk!r}.")
                if risk.get("name") == "Perish Song" and horde_only:
                    errors.append(f"Perish Song is incorrectly active in horde-only table {table_id}.")
                if risk.get("name") in {"Rage Powder", "Follow Me"} and not multiple_opponents:
                    errors.append(f"Redirection risk {risk.get('name')} is active in single-only table {table_id}.")
                if risk.get("name") in {"Dry Skin", "Solar Power", "Healing Wish", "Lunar Dance"}:
                    errors.append(f"Unverified/context-missing safety rule {risk.get('name')} is active in table {table_id}.")
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

    voltorb_selfdestruct = any(
        int(component.get("pokemonId", -1)) == 100 and any(risk.get("name") == "Selfdestruct" for risk in component.get("safetyRisks", []))
        for table in encounter_tables.values()
        for component in table.get("components", [])
        if int(component.get("maxLevel", 0)) >= 28
    )
    if not voltorb_selfdestruct:
        errors.append("Safety regression failed: Voltorb Selfdestruct is not marked at applicable levels.")

    def has_risk(pid: int, name: str, *, non_safari: bool = True) -> bool:
        return any(
            int(component.get("pokemonId", -1)) == pid
            and any(risk.get("name") == name for risk in component.get("safetyRisks", []))
            for table in encounter_tables.values()
            if not non_safari or not table.get("safari")
            for component in table.get("components", [])
        )

    for pid, name, risk_name in (
        (63, "Abra", "Teleport"),
        (60, "Poliwag", "Belly Drum"),
        (331, "Cacnea", "Sticky Barb"),
        (235, "Smeargle", "Sketch"),
        (132, "Ditto", "Transform"),
    ):
        if not has_risk(pid, risk_name):
            errors.append(f"Safety regression failed: {name} lacks its expected {risk_name} warning.")

    if not any(
        risk.get("name") == "Rage Powder"
        for table in encounter_tables.values() if not table.get("safari")
        for component in table.get("components", [])
        for risk in component.get("safetyRisks", [])
    ):
        errors.append("Safety regression failed: no context-aware Rage Powder warnings were generated.")
    if not any(
        risk.get("name") == "Follow Me"
        for table in encounter_tables.values() if not table.get("safari")
        for component in table.get("components", [])
        for risk in component.get("safetyRisks", [])
    ):
        errors.append("Safety regression failed: no context-aware Follow Me warnings were generated.")
    if not any(
        risk.get("name") in {"Trick", "Switcheroo"}
        for table in encounter_tables.values() if not table.get("safari")
        for component in table.get("components", [])
        for risk in component.get("safetyRisks", [])
    ):
        errors.append("Safety regression failed: no setup-dependent Trick/Switcheroo warnings were generated.")

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

        expected_categories: dict[str, set[tuple[str, str]]] = {}
        expected_risks: dict[tuple[str, str], dict] = {}
        lure_exclusive_pairs: set[tuple[str, str]] = set()
        has_lure_source = False
        has_non_lure_source = False
        for hunt in hunts:
            table = encounter_tables.get(str(hunt.get("tableId")), {})
            component = next((row for row in table.get("components", []) if int(row.get("pokemonId", -1)) == pid), None)
            for category in semantic_categories_for(pid, hunt, table):
                expected_categories.setdefault(category, set()).update(
                    (pair["season"], pair["time"]) for pair in hunt.get("availability", [])
                )
            if component:
                source_kinds = {str(source.get("kind", "")) for source in component.get("sources", [])}
                if "lure" in source_kinds:
                    has_lure_source = True
                    lure_exclusive_pairs.update(
                        (pair["season"], pair["time"]) for pair in hunt.get("availability", [])
                    )
                if source_kinds - {"lure"}:
                    has_non_lure_source = True
                for risk in component.get("safetyRisks", []):
                    expected_risks[(str(risk.get("kind")), str(risk.get("name")))] = risk
        listed_categories = p.get("dexCategories", [])
        compact_category_availability = p.get("categoryAvailability", {})
        if "Special" in listed_categories:
            expected_categories["Special"] = {
                (pair.get("season"), pair.get("time"))
                for pair in compact_category_availability.get("Special", [])
            }
        if has_lure_source and not has_non_lure_source and "Special" not in listed_categories:
            expected_categories["Lure-exclusive"] = lure_exclusive_pairs
        if pid in FOSSIL_SPECIES:
            expected_categories["Fossil"] = {("Any", time) for time in VALID_TIMES}
        if set(listed_categories) != set(expected_categories):
            errors.append(f"Semantic Pokédex categories for #{pid} do not match detailed encounter data.")
        if any(category not in category_ids for category in listed_categories):
            errors.append(f"Semantic Pokédex categories for #{pid} use an unknown category.")
        expected_search_categories = set(listed_categories)
        if "5× Horde · 100%" in expected_search_categories:
            expected_search_categories.discard("5× Horde · Split")
        if "3× Horde · 100%" in expected_search_categories:
            expected_search_categories.discard("3× Horde · Split")
        if set(p.get("dexSearchCategories", [])) != expected_search_categories:
            errors.append(f"Pokédex search categories for #{pid} do not apply the 100%-over-split priority.")
        if set(compact_category_availability) != set(expected_categories):
            errors.append(f"Category availability keys for #{pid} do not match its semantic categories.")
        for category, pairs in compact_category_availability.items():
            actual_pairs = {(pair.get("season"), pair.get("time")) for pair in pairs}
            for season, time in actual_pairs:
                if season not in VALID_SEASONS or time not in VALID_TIMES:
                    errors.append(f"Category availability for #{pid} {category} contains invalid {season!r}/{time!r}.")
            if actual_pairs != expected_categories.get(category, set()):
                errors.append(f"Category availability for #{pid} {category} does not match detailed encounters.")
        actual_risk_keys = {(str(risk.get("kind")), str(risk.get("name"))) for risk in p.get("wildSafetyRisks", [])}
        if actual_risk_keys != set(expected_risks):
            errors.append(f"Compact safety-risk summary for #{pid} does not match encounter components.")

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
        if not row.get("safari"):
            continue
        if row.get("safetyWarningsApplicable") is not False:
            errors.append(f"Safari route row {n} must suppress safety warnings.")
        if row.get("slowdownWarningsApplicable") is not False:
            errors.append(f"Safari route row {n} must suppress start-delay warnings.")
        region = row.get("region")
        location_id = int(row.get("locationId", 0) or 0)
        if region == "Johto" and location_id in JOHTO_SAFARI_AREAS:
            expected = f"Safari Zone — {JOHTO_SAFARI_AREAS[location_id]}"
            if row.get("location") != expected:
                errors.append(f"Johto Safari area mapping failed for location ID {location_id}: {row.get('location')!r}.")
            if row.get("encounterType") == "Cave":
                errors.append(f"Johto Safari location ID {location_id} still uses the dump-internal Cave label.")
        if region == "Hoenn" and location_id in HOENN_SAFARI_LABELS and row.get("location") != HOENN_SAFARI_LABELS[location_id]:
            errors.append(f"Hoenn Safari area numbering failed for location ID {location_id}: {row.get('location')!r}.")
        if region == "Sinnoh" and row.get("encounterType") == "Inside":
            errors.append(f"Sinnoh Great Marsh row {n} still uses the dump-internal Inside label.")

    training_hordes = training_index.get("hordes", [])
    maximum_ev_hordes = training_index.get("evHordes", [])
    ev_categories = training_index.get("evCategories", [])
    if int(build_info.get("trainingHordes", -1)) != len(training_hordes):
        errors.append(f"build-info training horde count is {build_info.get('trainingHordes')}, training index contains {len(training_hordes)}.")
    if int(build_info.get("maximumEvHordes", -1)) != len(maximum_ev_hordes):
        errors.append(f"build-info maximum EV horde count is {build_info.get('maximumEvHordes')}, training index contains {len(maximum_ev_hordes)}.")
    if int(build_info.get("evTrainingCategories", -1)) != len(ev_categories):
        errors.append(f"build-info EV category count is {build_info.get('evTrainingCategories')}, training index contains {len(ev_categories)}.")

    valid_ev_stats = {"HP", "Attack", "Defense", "Sp. Attack", "Sp. Defense", "Speed"}
    requested_split_categories = {
        "Attack / Speed": {"Attack", "Speed"},
        "Sp. Attack / Speed": {"Sp. Attack", "Speed"},
    }
    expected_categories = valid_ev_stats | set(requested_split_categories)
    category_ids = {row.get("id") for row in ev_categories}
    if category_ids != expected_categories:
        errors.append(f"EV training categories differ from the requested set: {sorted(category_ids)}.")

    seen_training_signatures = set()
    rows_by_table = {}
    for row in training_hordes:
        table_id = str(row.get("tableId"))
        rows_by_table[table_id] = row
        if table_id not in encounter_tables:
            errors.append(f"Training row references missing encounter table {table_id}.")
            continue
        if row.get("method") != "5× Horde" or int(row.get("hordeSize", 0)) != 5:
            errors.append(f"Training row {table_id} must be a 5× Horde, got {row.get('method')!r}/{row.get('hordeSize')!r}.")
        if float(row.get("estimatedExp", 0) or 0) <= 0:
            errors.append(f"Training row {table_id} has no positive EXP estimate.")
        species = row.get("species", [])
        if not species:
            errors.append(f"Training row {table_id} has no species preview.")
        for pair in row.get("availability", []):
            if pair.get("season") not in VALID_SEASONS or pair.get("time") not in VALID_TIMES:
                errors.append(f"Training row {table_id} has invalid availability {pair}.")

        species_stats = {species_row.get("evStat") for species_row in species}
        pure_stat = row.get("pureEvStat")
        category = row.get("evCategory")
        category_kind = row.get("evCategoryKind")
        if pure_stat:
            if pure_stat not in valid_ev_stats or species_stats != {pure_stat}:
                errors.append(f"Training row {table_id} is marked pure {pure_stat!r} but its species yields do not match.")
            if category != pure_stat or category_kind != "pure":
                errors.append(f"Training row {table_id} does not map its pure EV stat to the same category.")
        elif len(species_stats) == 1 and next(iter(species_stats), None) in valid_ev_stats:
            errors.append(f"Training row {table_id} is a pure EV table but is not labelled as such.")

        if category:
            expected_ev_by_stat = {}
            expected_pool_share = {}
            for species_row in species:
                stat = species_row.get("evStat")
                ev_yield = int(species_row.get("evYield", 0) or 0)
                share = float(species_row.get("share", 0) or 0)
                if stat and ev_yield > 0:
                    expected_ev_by_stat[stat] = expected_ev_by_stat.get(stat, 0.0) + share * 5 * ev_yield
                    expected_pool_share[stat] = expected_pool_share.get(stat, 0.0) + share
            expected_total = sum(expected_ev_by_stat.values())
            if abs(expected_total - float(row.get("evExpected", 0) or 0)) > 0.011:
                errors.append(f"Training row {table_id} EV estimate mismatch: {row.get('evExpected')} vs {expected_total:.2f}.")
            actual_breakdown = {key: float(value) for key, value in row.get("evExpectedByStat", {}).items()}
            actual_pool_share = {key: float(value) for key, value in row.get("evPoolShareByStat", {}).items()}
            if set(actual_breakdown) != set(expected_ev_by_stat) or any(abs(actual_breakdown[key] - value) > 0.011 for key, value in expected_ev_by_stat.items()):
                errors.append(f"Training row {table_id} EV-stat breakdown is inconsistent.")
            if set(actual_pool_share) != set(expected_pool_share) or any(abs(actual_pool_share[key] - value) > 0.00001 for key, value in expected_pool_share.items()):
                errors.append(f"Training row {table_id} EV pool-share breakdown is inconsistent.")
            if category in requested_split_categories:
                if category_kind != "split-50-50" or set(expected_pool_share) != requested_split_categories[category]:
                    errors.append(f"Training row {table_id} is not the requested {category} split.")
                if any(abs(value - 0.5) > 0.00001 for value in expected_pool_share.values()):
                    errors.append(f"Training row {table_id} {category} pool is not exactly 50/50.")

        signature = json.dumps({key: row.get(key) for key in ("region", "location", "encounterType", "method", "availability", "species")}, sort_keys=True)
        if signature in seen_training_signatures:
            errors.append(f"Training index contains a duplicate displayed horde row at table {table_id}.")
        seen_training_signatures.add(signature)

    max_by_category = {}
    for category in expected_categories:
        values = [float(row.get("evExpected") or 0) for row in training_hordes if row.get("evCategory") == category]
        if values:
            max_by_category[category] = max(values)
    maximum_ids = {str(row.get("tableId")) for row in maximum_ev_hordes}
    for row in maximum_ev_hordes:
        table_id = str(row.get("tableId"))
        category = row.get("evCategory")
        if table_id not in rows_by_table:
            errors.append(f"Maximum EV row {table_id} is absent from the complete 5× training index.")
        if category not in max_by_category or abs(float(row.get("evExpected") or 0) - max_by_category[category]) > 0.000001:
            errors.append(f"Maximum EV row {table_id} is not maximum-yield for {category!r}.")
    expected_maximum_ids = {
        str(row.get("tableId")) for row in training_hordes
        if row.get("evCategory") in max_by_category
        and abs(float(row.get("evExpected") or 0) - max_by_category[row.get("evCategory")]) <= 0.000001
    }
    if maximum_ids != expected_maximum_ids:
        errors.append("Curated EV index does not contain exactly the maximum-yield rows for every category.")

    category_max_metadata = {row.get("id"): float(row.get("maxExpected", 0) or 0) for row in ev_categories}
    if set(category_max_metadata) != set(max_by_category) or any(abs(category_max_metadata[key] - value) > 0.011 for key, value in max_by_category.items()):
        errors.append("EV category maximum-yield metadata does not match the generated rows.")

    mt_silver_top = [row for row in training_hordes if row.get("location") == "Mt. Silver Cave (Upper Mountainside)"]
    if not any(float(row.get("estimatedExp", 0)) >= 7900 for row in mt_silver_top):
        errors.append("EXP training regression failed: Mt. Silver Upper Mountainside should contain an approximately 8,000 EXP horde.")
    cerulean_golduck = [row for row in training_hordes if row.get("location") == "Cerulean Cave (B1F)" and [species.get("name") for species in row.get("species", [])] == ["Golduck"]]
    if not any(7000 <= float(row.get("estimatedExp", 0)) <= 7300 for row in cerulean_golduck):
        errors.append("EXP training regression failed: Cerulean Cave B1F Golduck should estimate near 7,125 EXP per horde.")

    if int(build_info.get("huntOptions", -1)) != hunt_count:
        errors.append(f"build-info hunt count is {build_info.get('huntOptions')}, generated files contain {hunt_count}.")
    if int(build_info.get("itemSprites", -1)) != len(held_item_ids):
        errors.append(f"build-info item sprite count is {build_info.get('itemSprites')}, expected {len(held_item_ids)} held-item icons.")

    # Latest-dump Lure location coverage. These catch the most visible floor,
    # room and species-slot changes so an older partial dump cannot be rebuilt silently.
    lure_location_regressions = [
        (5, "Kanto", "Rock Tunnel (1F)", "Lure Singles", True, "Charmeleon should use Rock Tunnel 1F"),
        (5, "Kanto", "Rock Tunnel (B1F)", "Lure Singles", True, "Charmeleon should also use Rock Tunnel B1F"),
        (65, "Sinnoh", "Route 215", "Lure Singles", True, "Alakazam should occupy the Route 215 Lure slot"),
        (463, "Sinnoh", "Route 215", "Lure Singles", False, "Lickilicky should no longer occupy the Route 215 Lure slot"),
        (94, "Kanto", "Pokémon Tower (3F)", "Lure Singles", True, "Gengar should use Pokémon Tower 3F"),
        (94, "Kanto", "Pokémon Tower (7F)", "Lure Singles", True, "Gengar should include Pokémon Tower 7F"),
        (247, "Unova", "Victory Road (1F)", "Lure Singles", True, "Pupitar should use Unova Victory Road 1F"),
        (247, "Unova", "Victory Road (7F)", "Lure Singles", True, "Pupitar should include Unova Victory Road 7F"),
        (429, "Johto", "Bell Tower (2F)", "Lure Singles", True, "Mismagius should use Bell Tower 2F"),
        (429, "Johto", "Bell Tower (8F)", "Lure Singles", True, "Mismagius should use Bell Tower 8F"),
        (479, "Sinnoh", "Old Chateau (1F)", "Lure Singles", True, "Rotom should use Old Chateau 1F"),
        (479, "Sinnoh", "Old Chateau (2F)", "Lure Singles", True, "Rotom should include Old Chateau 2F rooms"),
        (319, "Sinnoh", "Great Marsh — Area 1", "Lure Safari", True, "Sharpedo should use Great Marsh Area 1"),
        (469, "Sinnoh", "Great Marsh — Area 1", "Lure Safari", True, "Yanmega should use Great Marsh Area 1"),
    ]
    for pid, region, location, method, expected_present, message in lure_location_regressions:
        present = has_option(pid, region=region, location=location, method=method)
        if present != expected_present:
            errors.append(f"Latest Lure dump regression failed: {message}.")

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

    # v0.27 encounter-pace defaults and slowdown propagation.
    method_defaults = {row.get("id"): row.get("defaultEph") for row in methods}
    expected_defaults = {
        "5× Horde": 1200, "3× Horde": 720, "Lure Singles": 280,
        "Lure Safari": 300, "Singles": 220, "Surfing": 220, "Safari": 300,
        "Old Rod": 270, "Good Rod": 270, "Super Rod": 270,
        "Fishing + Lure": 340, "Fishing + Chum Bucket": 460, "Fishing + Lure + Chum Bucket": 470, "Fossil": 530,
        "Rock Smash": 120, "Headbutt": 120, "Honey Tree": 250,
    }
    for method, expected in expected_defaults.items():
        if method_defaults.get(method) != expected:
            errors.append(f"Unexpected default pace for {method}: {method_defaults.get(method)} != {expected}")
    # v0.28 fishing modifiers, fossil revival rows and Altering Cave community data.
    route_method_counts = Counter(str(row.get("method", "")) for row in route_index)
    base_fishing_tables = sum(route_method_counts.get(method, 0) for method in ("Old Rod", "Good Rod", "Super Rod", "Fishing"))
    for modifier in ("Fishing + Lure", "Fishing + Chum Bucket", "Fishing + Lure + Chum Bucket"):
        if route_method_counts.get(modifier, 0) != base_fishing_tables:
            errors.append(f"{modifier} table count {route_method_counts.get(modifier, 0)} != baseline fishing table count {base_fishing_tables}.")
    fossil_routes = [row for row in route_index if row.get("method") == "Fossil"]
    if len(fossil_routes) != 9:
        errors.append(f"Expected 9 directly revivable Fossil tables, found {len(fossil_routes)}.")
    for row in fossil_routes:
        table = encounter_tables.get(str(row.get("tableId")), {})
        components = table.get("components", [])
        if len(components) != 1 or abs(float(components[0].get("share", 0)) - 1.0) > 0.000001:
            errors.append(f"Fossil table {row.get('tableId')} must contain exactly one 100% revival species.")
    if "current" in altering_cave:
        errors.append("Altering Cave must not expose a static current/active rotation; the cave changes every in-game day.")
    dark3 = altering_cave.get("types", {}).get("Dark", {}).get("rotations", {}).get("3", {})
    if [row.get("name") for row in dark3.get("singles", [])] != ["Tyranitar", "Solrock", "Gothorita", "Munna", "Krookodile", "Umbreon", "Pawniard"]:
        errors.append("Altering Cave Dark Rotation 3 observed singles changed unexpectedly.")
    if [row.get("name") for row in dark3.get("hordes", [])] != ["Nidorina", "Scrafty"]:
        errors.append("Altering Cave Dark Rotation 3 observed hordes changed unexpectedly.")
    rng = altering_cave.get("rngModel", {})
    recipe = rng.get("recipe", {})
    if recipe.get("commonSingles") != 5 or recipe.get("typeSingles") != 2 or recipe.get("commonHordes") != 1 or recipe.get("typeHordes") != 1:
        errors.append(f"Altering Cave RNG recipe changed unexpectedly: {recipe!r}")
    evidence = rng.get("evidence", {})
    if evidence.get("observedRotations") != 37 or evidence.get("exactMatchesToCurrentPoolLists") != 27:
        errors.append(f"Altering Cave RNG evidence changed unexpectedly: {evidence!r}")
    if len(rng.get("commonSingles", [])) < 100 or len(rng.get("commonHordes", [])) != 30:
        errors.append("Altering Cave RNG common-pool data is missing or unexpectedly small.")
    if altering_cave.get("limitations", {}).get("rankingEnabled") is not False:
        errors.append("Altering Cave must remain excluded from encounter-rate rankings until encounter percentages are sourced.")

    route_by_table = {str(row.get("tableId")): row for row in route_index}
    for table_id, table in encounter_tables.items():
        expected_slow = bool(
            table.get("slowdownWarningsApplicable", True)
            and any(component.get("slowAbilities") for component in table.get("components", []))
        )
        route_row = route_by_table.get(str(table_id))
        if route_row and bool(route_row.get("hasSlowdown")) != expected_slow:
            errors.append(f"Route table {table_id} slowdown flag does not match components.")

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
    print("- Directed evolution roots/stages, readable Hunter routes, encounter labels, methods, shares and table references are valid")
    print("- No control characters or decorated dump prefixes leaked into published labels")
    print(f"- {len(encounter_tables):,} full encounter tables and {len(route_index):,} route-search rows validated")
    print(f"- {len(training_hordes):,} 5× horde training rows validated, with {len(maximum_ev_hordes):,} maximum-yield EV rows across {len(ev_categories)} categories")
    print("- EV training contains only category-leading yields, including exact Attack/Speed and Sp. Attack/Speed 50/50 pools")
    print("- EXP rankings use a transparent base-EXP × average-level ÷ 7 estimate and preserve season/time availability")
    print("- Start-of-battle slowdown indicators and Safari catch estimates are present")
    print("- Safari safety warnings are suppressed while global Pokédex warnings remain available")
    print("- Johto Safari biome names, Hoenn area numbers and Safari walking labels are normalized to Grass")
    print("- Johto 90% and Sinnoh 80% static grass pools carry clear source-coverage metadata")
    print("- Safari Zone Gate is correctly classified as Headbutt, not Safari")
    print("- Lure, globally Lure-exclusive, Special/phenomenon and Fossil Pokédex categories validated")
    print("- 100% horde species keep their labels but are excluded from the corresponding Split search")
    print("- Latest corrected Lure floors, rooms, species slots and Safari areas validated")
    print("- Bulbasaur Lure-exclusive encounter roll = 5%")
    print("- Route 229 Autumn Night 5× Horde = Ariados 40%, Volbeat 30%, Illumise 30%")
    print("- Natural 5% horde blocks are included in Singles and Lure Singles, then extracted separately for Sweet Scent")
    print("- Route 32 Lure table = 95% scaled base outcomes + 5% lure-exclusive outcome; 1.095 Pokémon shown per roll")
    print("- Default horde speeds = 1,200 / 720; slowdown-adjusted horde speeds = 1,100 / 660 encounters per hour")
    print(f"- Fishing modifiers duplicate all {base_fishing_tables:,} rod tables without changing their species pools; defaults = 340 / 460 / 470 per hour")
    print("- 9 directly revivable fossil species use deterministic 100% Fossil tables at 530 revivals/hour")
    print("- Altering Cave catalogue/RNG model validated: no static current rotation; experimental 5+2 / 1+1 recipe retained; exact rates intentionally unranked")
    print(f"- Confidence totals: High {confidence_counts['High']:,}, Medium {confidence_counts['Medium']:,}, Low {confidence_counts['Low']:,}")
    if warnings:
        print("WARNINGS")
        for warning in warnings:
            print("-", warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
