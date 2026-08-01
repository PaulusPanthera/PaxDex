#!/usr/bin/env python3
"""Build the local PaxDex website data from a PokeMMO moddable-resource dump."""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import sys
import zipfile
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

TIMES = ("Morning", "Day", "Night")
SEASONS = ("Spring", "Summer", "Autumn", "Winter")
TIME_FIELDS = {
    "Morning": "rarity_morning",
    "Day": "rarity_day",
    "Night": "rarity_night",
}
SAFARI_RE = re.compile(r"safari|great marsh", re.I)
NON_SAFARI_LOCATION_RE = re.compile(r"^safari zone gate$", re.I)
CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f]")
ASCII_LABEL_START_RE = re.compile(r"[A-Za-z0-9]")
REGION_LABEL_RE = re.compile(r"\[\s*([A-Za-z]+)\s*\]")
REGION_ID_NAMES = {0: "Kanto", 1: "Hoenn", 2: "Unova", 3: "Sinnoh", 4: "Johto"}

# The dump exposes the twelve Johto Safari biomes as stable location IDs, but
# gives every one of them the same generic location name and marks on-foot encounters as
# "Cave". The species pools match the standard biome names one-to-one.
JOHTO_SAFARI_AREAS = {
    343: "Plains",
    344: "Meadow",
    345: "Savannah",
    346: "Peak",
    347: "Rocky Beach",
    348: "Wetland",
    349: "Forest",
    350: "Swamp",
    351: "Marshland",
    352: "Wasteland",
    353: "Mountain",
    354: "Desert",
}

# Hoenn already has descriptive compass labels in the dump. These numbers are
# the familiar guide-area numbering and are added only as a secondary label.
HOENN_SAFARI_AREA_NUMBERS = {
    844: 1,   # South / entrance
    588: 2,   # Southwest
    76: 3,    # Northwest
    332: 4,   # North
    3404: 5,  # Southeast
    3148: 6,  # Northeast
}


def clean_decorated_label(value: Any) -> str:
    """Strip control/icon prefixes that can leak in from custom client strings."""
    text = CONTROL_CHAR_RE.sub("", str(value or ""))
    start = ASCII_LABEL_START_RE.search(text)
    if start:
        text = text[start.start():]
    return text.strip()


def clean_region_name(value: Any, region_id: Any) -> str:
    """Normalize decorated region headers back to their plain region name."""
    text = str(value or "")
    match = REGION_LABEL_RE.search(text)
    if match:
        return match.group(1).title()
    cleaned = clean_decorated_label(text)
    if cleaned:
        return cleaned
    try:
        return REGION_ID_NAMES.get(int(region_id), "Unknown")
    except (TypeError, ValueError):
        return "Unknown"


def load_dump_json(zf: zipfile.ZipFile, member: str) -> Any:
    """Load a dump JSON file while tolerating literal control characters in strings."""
    return json.loads(zf.read(member).decode("utf-8"), strict=False)

def is_safari_location(location: str) -> bool:
    """Return True only for locations where Safari battle rules actually apply."""
    name = str(location).strip()
    return bool(SAFARI_RE.search(name)) and not bool(NON_SAFARI_LOCATION_RE.fullmatch(name))


def normalize_safari_location(region: str, location_id: int, location: str) -> str:
    """Replace ambiguous Safari labels with stable, user-facing area names."""
    if region == "Johto" and location_id in JOHTO_SAFARI_AREAS:
        return f"Safari Zone — {JOHTO_SAFARI_AREAS[location_id]}"
    if region == "Hoenn" and location_id in HOENN_SAFARI_AREA_NUMBERS:
        area_match = re.search(r"\(([^)]+)\)", location)
        area_name = area_match.group(1) if area_match else location.replace("Safari Zone", "").strip(" -—()")
        return f"Safari Zone — {area_name} (Area {HOENN_SAFARI_AREA_NUMBERS[location_id]})"
    if region == "Kanto" and location.startswith("Safari Zone ("):
        return location.replace("Safari Zone (", "Safari Zone — ").rstrip(")")
    if region == "Sinnoh" and location.startswith("Great Marsh ("):
        return location.replace("Great Marsh (", "Great Marsh — ").rstrip(")")
    return location


def normalize_safari_encounter_type(region: str, encounter_type: str, safari: bool) -> str:
    """Translate dump-internal Safari walking labels into the standard Grass label."""
    if not safari:
        return encounter_type
    if region == "Johto" and encounter_type == "Cave":
        return "Grass"
    if region == "Sinnoh" and encounter_type == "Inside":
        return "Grass"
    return encounter_type

START_DELAY_ABILITIES = {
    "Intimidate", "Reactive Gas", "Pressure", "Unnerve", "Download",
    "Frisk", "Forewarn", "Anticipation", "Trace", "Mold Breaker",
    "Turboblaze", "Teravolt", "Drought", "Drizzle", "Sand Stream",
    "Snow Warning", "Air Lock", "Cloud Nine", "Slow Start", "Imposter",
}

# Every released member of the fossil-revival families through Generation V.
FOSSIL_SPECIES = {
    138, 139, 140, 141, 142,
    345, 346, 347, 348,
    408, 409, 410, 411,
    564, 565, 566, 567,
}

DEX_CATEGORY_DEFS = [
    {"id": "Lure", "label": "Lure", "group": "Special pools"},
    {"id": "Lure-exclusive", "label": "Lure-exclusive", "group": "Special pools"},
    {"id": "Safari", "label": "Safari", "group": "Special pools"},
    {"id": "Special", "label": "Special", "group": "Special pools"},
    {"id": "Fossil", "label": "Fossil", "group": "Special pools"},
    {"id": "5× Horde · 100%", "label": "5× Horde · 100%", "group": "Sweet Scent hordes"},
    {"id": "5× Horde · Split", "label": "5× Horde · Split", "group": "Sweet Scent hordes"},
    {"id": "3× Horde · 100%", "label": "3× Horde · 100%", "group": "Sweet Scent hordes"},
    {"id": "3× Horde · Split", "label": "3× Horde · Split", "group": "Sweet Scent hordes"},
    {"id": "Singles", "label": "Singles", "group": "Other encounters"},
    {"id": "Surfing", "label": "Surfing", "group": "Other encounters"},
    {"id": "Fishing", "label": "Fishing", "group": "Other encounters"},
    {"id": "Rock Smash", "label": "Rock Smash", "group": "Other encounters"},
    {"id": "Headbutt", "label": "Headbutt", "group": "Other encounters"},
    {"id": "Honey Tree", "label": "Honey Tree", "group": "Other encounters"},
]
DEX_CATEGORY_ORDER = {row["id"]: index for index, row in enumerate(DEX_CATEGORY_DEFS)}

# Moves are checked against the actual four level-up moves a wild Pokémon can
# know at each generated encounter level. The warning is deliberately broader
# than instant self-KO: recoil, crash damage and delayed self-KO are also useful
# shiny-hunting hazards.
SELF_HARM_MOVE_RULES = {
    "Selfdestruct": ("self-ko", "The user faints immediately."),
    "Explosion": ("self-ko", "The user faints immediately."),
    "Memento": ("self-ko", "The user faints immediately."),
    "Final Gambit": ("self-ko", "The user faints immediately."),
    "Healing Wish": ("self-ko", "The user faints immediately."),
    "Lunar Dance": ("self-ko", "The user faints immediately."),
    "Perish Song": ("countdown", "The user can faint when the perish count reaches zero."),
    "Take Down": ("recoil", "The user takes recoil damage."),
    "Double-Edge": ("recoil", "The user takes recoil damage."),
    "Submission": ("recoil", "The user takes recoil damage."),
    "Brave Bird": ("recoil", "The user takes recoil damage."),
    "Flare Blitz": ("recoil", "The user takes recoil damage."),
    "Head Smash": ("recoil", "The user takes heavy recoil damage."),
    "Volt Tackle": ("recoil", "The user takes recoil damage."),
    "Wood Hammer": ("recoil", "The user takes recoil damage."),
    "Wild Charge": ("recoil", "The user takes recoil damage."),
    "Head Charge": ("recoil", "The user takes recoil damage."),
    "Jump Kick": ("crash", "The user takes crash damage if the move misses or fails."),
    "Hi Jump Kick": ("crash", "The user takes crash damage if the move misses or fails."),
    "Curse": ("hp-loss", "Ghost-type users sacrifice half of their maximum HP."),
    "Thrash": ("confusion", "The user becomes confused after the locked attack ends."),
    "Outrage": ("confusion", "The user becomes confused after the locked attack ends."),
    "Petal Dance": ("confusion", "The user becomes confused after the locked attack ends."),
}
SELF_HARM_ABILITY_RULES = {
    "Dry Skin": ("weather", "The Pokémon loses HP each turn in harsh sunlight."),
    "Solar Power": ("weather", "The Pokémon loses HP each turn in harsh sunlight."),
}


def wild_moves_at_level(level_moves: list[dict[str, Any]], level: int) -> list[str]:
    """Return the four level-up moves used by a wild Pokémon at a level."""
    known: list[str] = []
    for move in level_moves:
        try:
            learned_at = int(move.get("level", 0) or 0)
        except (TypeError, ValueError):
            continue
        if learned_at > level:
            continue
        name = str(move.get("name") or "").strip()
        if not name:
            continue
        if name in known:
            known.remove(name)
        known.append(name)
    return known[-4:]


def compact_level_ranges(levels: set[int]) -> str:
    if not levels:
        return ""
    ordered = sorted(levels)
    ranges: list[str] = []
    start = previous = ordered[0]
    for level in ordered[1:]:
        if level == previous + 1:
            previous = level
            continue
        ranges.append(str(start) if start == previous else f"{start}–{previous}")
        start = previous = level
    ranges.append(str(start) if start == previous else f"{start}–{previous}")
    return ", ".join(ranges)


def parse_rate(value: Any) -> tuple[str, float]:
    if value is None:
        return "none", 0.0
    text = str(value).strip()
    if not text or text in {"--", "-"}:
        return "none", 0.0
    if text.lower() == "lure":
        return "lure", 0.0
    if text.lower() == "special":
        return "special", 0.0
    if text.endswith("%"):
        try:
            return "rate", float(text[:-1]) / 100.0
        except ValueError:
            return "none", 0.0
    try:
        number = float(text)
        return "rate", number / 100.0 if number > 1 else number
    except ValueError:
        return "none", 0.0


def method_for(encounter_type: str, safari: bool, lure: bool = False) -> str:
    if lure:
        return "Lure Safari" if safari else "Lure Singles"
    if safari:
        return "Safari"
    if encounter_type == "Water":
        return "Surfing"
    if encounter_type in {"Old Rod", "Good Rod", "Super Rod", "Fishing"}:
        return "Fishing"
    if encounter_type == "Rocks":
        return "Rock Smash"
    if encounter_type == "Headbutt":
        return "Headbutt"
    if encounter_type == "Honey Tree":
        return "Honey Tree"
    if encounter_type in {"Dust Cloud", "Shadow"}:
        return "Special"
    return "Singles"


def safari_pool_metadata(region: str, encounter_type: str, method: str, raw_total: float, safari: bool) -> dict[str, Any] | None:
    """Describe Safari source coverage without calling an incomplete base pool a bad calculation."""
    if not safari:
        return None
    lure_model = method.startswith("Lure")
    if region == "Johto" and encounter_type == "Grass":
        return {
            "status": "partial",
            "label": "Base grass pool",
            "documentedTotal": 0.9,
            "lureModel": lure_model,
            "note": (
                "The static dump documents the 90% base grass pool. "
                "Block- and rotation-dependent encounters are not assigned to this table."
            ),
        }
    if region == "Sinnoh" and encounter_type == "Grass":
        return {
            "status": "partial",
            "label": "Base grass pool",
            "documentedTotal": 0.8,
            "lureModel": lure_model,
            "note": (
                "The static dump documents the 80% base grass pool. "
                "Daily Great Marsh rotation encounters are not included."
            ),
        }
    return {
        "status": "complete" if abs(raw_total - 1.0) <= 0.03 else "partial",
        "label": "Encounter pool",
        "documentedTotal": round(raw_total, 7),
        "lureModel": lure_model,
        "note": "Complete static Safari encounter table." if abs(raw_total - 1.0) <= 0.03 else "The static Safari table is not documented as a complete 100% pool.",
    }


def table_confidence(total: float, horde: bool = False, lure: bool = False, special: bool = False, explicit_sweet: bool = False) -> tuple[str, str]:
    if lure:
        return "Medium", "The 5% Lure-exclusive slot is modelled separately."
    if special:
        return "Low", "Special encounters do not have a reliable encounters/hour default."
    if horde:
        if explicit_sweet:
            return "High", "Explicit Sweet Scent table normalized to 100%."
        if abs(total - 0.05) <= 0.006:
            return "High", "5% Sweet Scent block normalized to 100%."
        return "Medium", f"Unusual raw horde-block total: {total * 100:.2f}%."
    if abs(total - 1.0) <= 0.03:
        return "High", "Complete encounter table."
    if abs(total - 0.95) <= 0.02:
        return "Medium", "The visible random pool totals 95%; no matching natural horde block was available to complete it."
    if 0.90 <= total <= 1.10:
        return "Medium", f"Table normalized from {total * 100:.2f}%."
    return "Low", f"Possibly incomplete table: {total * 100:.2f}%."


def safe_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def pick_zip_member(names: set[str], patterns: list[str]) -> str | None:
    for p in patterns:
        if p in names:
            return p
    return None


def extract_sprites(zf: zipfile.ZipFile, root: Path, max_id: int) -> dict[str, int]:
    names = set(zf.namelist())
    counts = defaultdict(int)
    for pid in range(1, max_id + 1):
        # Compact party icons for the grid.
        for shiny, target_dir in ((False, "icons"), (True, "icons-shiny")):
            suffix = "-s" if shiny else ""
            member = pick_zip_member(names, [
                f"sprites/monstericons/{pid}-0{suffix}.png",
                f"sprites/monstericons/{pid}-1{suffix}.png",
            ])
            if member:
                out = root / "sprites" / target_dir / f"{pid}.png"
                out.write_bytes(zf.read(member))
                counts[target_dir] += 1

        # Larger front sprites for the detail page. Prefer neutral, then male, then female.
        for shiny, target_dir, state in ((False, "normal", "n"), (True, "shiny", "s")):
            member = pick_zip_member(names, [
                f"sprites/battlesprites/{pid}-front-{state}.png",
                f"sprites/battlesprites/{pid}-front-{state}-m.png",
                f"sprites/battlesprites/{pid}-front-{state}-f.png",
            ])
            if member:
                out = root / "sprites" / target_dir / f"{pid}.png"
                out.write_bytes(zf.read(member))
                counts[target_dir] += 1

    # Some dump versions omit compact party icons for a few released species.
    # Fall back to the matching front sprite so the grid never shows a broken image.
    for pid in range(1, max_id + 1):
        for icon_dir, sprite_dir in (("icons", "normal"), ("icons-shiny", "shiny")):
            icon = root / "sprites" / icon_dir / f"{pid}.png"
            sprite = root / "sprites" / sprite_dir / f"{pid}.png"
            if not icon.exists() and sprite.exists():
                shutil.copy2(sprite, icon)

    # Report the actual retained coverage. Some update dumps contain data only,
    # so existing sprites intentionally remain in place.
    for target_dir in ("icons", "icons-shiny", "normal", "shiny"):
        counts[target_dir] = sum(
            1 for pid in range(1, max_id + 1)
            if (root / "sprites" / target_dir / f"{pid}.png").exists()
        )
    return dict(counts)



def extract_item_icons(zf: zipfile.ZipFile, root: Path, item_ids: set[int]) -> int:
    """Extract only item icons used by PaxDex, retaining existing icons for data-only dumps."""
    names = set(zf.namelist())
    out_dir = root / "sprites" / "items"
    out_dir.mkdir(parents=True, exist_ok=True)
    fallback_member = "sprites/itemicons/-1.png"
    fallback_path = out_dir / "-1.png"
    if fallback_member in names:
        fallback_path.write_bytes(zf.read(fallback_member))
    for item_id in sorted(item_ids):
        member = f"sprites/itemicons/{item_id}.png"
        target = out_dir / f"{item_id}.png"
        if member in names:
            target.write_bytes(zf.read(member))
        elif not target.exists() and fallback_path.exists():
            shutil.copy2(fallback_path, target)
    return sum(1 for item_id in item_ids if (out_dir / f"{item_id}.png").exists())

def connected_evolution_lines(monsters: dict[int, dict[str, Any]], max_id: int) -> dict[int, list[int]]:
    graph: dict[int, set[int]] = {pid: set() for pid in range(1, max_id + 1)}
    for pid, mon in monsters.items():
        if pid > max_id:
            continue
        for evo in mon.get("evolutions", []):
            eid = int(evo.get("id", 0) or 0)
            if 1 <= eid <= max_id:
                graph[pid].add(eid)
                graph[eid].add(pid)
    result: dict[int, list[int]] = {}
    for pid in graph:
        seen = {pid}
        q = deque([pid])
        while q:
            cur = q.popleft()
            for nxt in graph[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    q.append(nxt)
        result[pid] = sorted(seen)
    return result


def build(dump_zip: Path, root: Path) -> dict[str, Any]:
    data_dir = root / "data"
    for d in (data_dir / "pokemon", data_dir / "hunts", root / "sprites" / "icons", root / "sprites" / "icons-shiny", root / "sprites" / "normal", root / "sprites" / "shiny", root / "sprites" / "items"):
        d.mkdir(parents=True, exist_ok=True)

    # Remove generated per-Pokémon files so a smaller future dump cannot leave stale rows behind.
    for generated_dir in (data_dir / "pokemon", data_dir / "hunts"):
        for old in generated_dir.glob("*.json"):
            old.unlink()

    safari_rates_path = data_dir / "safari-rates.json"
    safari_rates = json.loads(safari_rates_path.read_text(encoding="utf-8")) if safari_rates_path.exists() else {"johto": {}, "sinnoh": {}}

    with zipfile.ZipFile(dump_zip) as zf:
        monsters_raw = load_dump_json(zf, "info/monsters.json")
        monsters_all = {int(m["id"]): m for m in monsters_raw}
        max_id = min(649, max(monsters_all))
        monsters = {pid: monsters_all[pid] for pid in range(1, max_id + 1) if pid in monsters_all}
        evo_lines = connected_evolution_lines(monsters, max_id)
        sprite_counts = extract_sprites(zf, root, max_id)
        item_ids = {
            int(item.get("id"))
            for mon in monsters.values()
            for item in mon.get("held_items", [])
            if item.get("id") is not None
        }
        item_sprite_count = extract_item_icons(zf, root, item_ids)

    index: list[dict[str, Any]] = []
    abilities_by_pid: dict[int, list[str]] = {}
    wild_abilities_by_pid: dict[int, list[str]] = {}
    slow_abilities_by_pid: dict[int, list[str]] = {}
    level_moves_by_pid: dict[int, list[dict[str, Any]]] = {}
    types_by_pid: dict[int, list[str]] = {}
    for pid, mon in monsters.items():
        types = []
        for t in mon.get("types", []):
            normalized = str(t).title() if t else ""
            if normalized and normalized not in types:
                types.append(normalized)
        types_by_pid[pid] = types
        forms = [f for f in mon.get("forms", []) if f.get("is_released", True)]
        evolution_line = evo_lines.get(pid, [pid])
        index.append({
            "id": pid,
            "name": mon.get("name", f"Pokémon {pid}"),
            "types": types,
            "obtainable": bool(mon.get("obtainable", False)),
            "hasLocations": bool(mon.get("locations")),
            "forms": [f.get("name") for f in forms if f.get("name")],
            "evolutionRootId": min(evolution_line),
            "evolutionLine": evolution_line,
        })

        raw_abilities = mon.get("abilities", [])
        unique_abilities = []
        seen_abilities = set()
        for slot, ability in enumerate(raw_abilities):
            name = ability.get("name")
            if name and name != "-" and name not in seen_abilities:
                seen_abilities.add(name)
                unique_abilities.append({"id": ability.get("id"), "name": name, "hidden": slot >= 2})
        abilities_by_pid[pid] = [x["name"] for x in unique_abilities]

        # Normal wild encounters can only roll the first two ability slots.
        # The third slot is the hidden ability and must not trigger a slowdown warning.
        wild_ability_names = []
        for ability in raw_abilities[:2]:
            name = ability.get("name")
            if name and name != "-" and name not in wild_ability_names:
                wild_ability_names.append(name)
        wild_abilities_by_pid[pid] = wild_ability_names
        slow_abilities_by_pid[pid] = [x for x in wild_ability_names if x in START_DELAY_ABILITIES]

        moves_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
        level_moves: list[dict[str, Any]] = []
        seen_moves: set[tuple] = set()
        for move in mon.get("moves", []):
            entry = {"id": move.get("id"), "name": move.get("name"), "type": str(move.get("type", "Other"))}
            if "level" in move:
                entry["level"] = move.get("level")
            if str(entry["type"]).lower() == "level":
                level_moves.append(entry.copy())
            sig = (entry["id"], entry["type"], entry.get("level"))
            if sig in seen_moves:
                continue
            seen_moves.add(sig)
            moves_by_type[entry["type"]].append(entry)

        level_moves_by_pid[pid] = level_moves

        detail = {
            "id": pid,
            "name": mon.get("name"),
            "types": types,
            "stats": mon.get("stats", {}),
            "abilities": unique_abilities,
            "eggGroups": [str(x).title() for x in mon.get("egg_groups", [])],
            "heightM": round(float(mon.get("height", 0)) / 10, 1),
            "weightKg": round(float(mon.get("weight", 0)) / 10, 1),
            "catchRate": mon.get("catch_rate"),
            "expType": mon.get("exp_type_name"),
            "obtainable": bool(mon.get("obtainable", False)),
            "forms": forms,
            "evolutions": [
                {
                    **evo,
                    **({"item_name": clean_decorated_label(evo.get("item_name"))} if evo.get("item_name") else {}),
                }
                for evo in mon.get("evolutions", [])
            ],
            "evolutionLine": evo_lines.get(pid, [pid]),
            "heldItems": [
                {**item, "name": clean_decorated_label(item.get("name"))}
                for item in mon.get("held_items", [])
            ],
            "moves": moves_by_type,
            "yields": mon.get("yields", {}),
        }
        safe_json(data_dir / "pokemon" / f"{pid}.json", detail)

    def self_harm_risks_for(pid: int, min_level: int, max_level: int) -> list[dict[str, Any]]:
        risks: list[dict[str, Any]] = []
        move_levels: dict[str, set[int]] = defaultdict(set)
        if min_level > 0 and max_level >= min_level:
            for level in range(min_level, max_level + 1):
                for move_name in wild_moves_at_level(level_moves_by_pid.get(pid, []), level):
                    if move_name not in SELF_HARM_MOVE_RULES:
                        continue
                    if move_name == "Curse" and "Ghost" not in types_by_pid.get(pid, []):
                        continue
                    move_levels[move_name].add(level)
        for move_name, levels in sorted(move_levels.items(), key=lambda row: (min(row[1]), row[0])):
            risk_type, description = SELF_HARM_MOVE_RULES[move_name]
            risks.append({
                "kind": "move", "name": move_name, "riskType": risk_type,
                "description": description, "levels": compact_level_ranges(levels),
            })
        for ability_name in wild_abilities_by_pid.get(pid, []):
            if ability_name not in SELF_HARM_ABILITY_RULES:
                continue
            risk_type, description = SELF_HARM_ABILITY_RULES[ability_name]
            risks.append({
                "kind": "ability", "name": ability_name, "riskType": risk_type,
                "description": description, "levels": "",
            })
        return risks

    # Hunt methods and user-facing encounter categories are appended to the compact
    # index after encounter data is built.

    # Encounter tables from the dump.
    normal_tables: dict[tuple, dict[int, dict[str, Any]]] = defaultdict(dict)
    horde_tables: dict[tuple, dict[int, dict[str, Any]]] = defaultdict(dict)
    lure_entries: dict[tuple, set[int]] = defaultdict(set)
    special_availability_by_pid: dict[int, set[tuple[str, str]]] = defaultdict(set)

    for pid, mon in monsters.items():
        for loc in mon.get("locations", []):
            region = clean_region_name(loc.get("region_name"), loc.get("region_id"))
            location_id = int(loc.get("location_id", 0) or 0)
            raw_location = str(loc.get("location_name_full") or loc.get("location_name") or "Unknown location")
            raw_encounter_type = clean_decorated_label(loc.get("type", "Unknown")) or "Unknown"
            season = str(loc.get("season", "Any") or "Any")
            safari = is_safari_location(raw_location)
            location = normalize_safari_location(region, location_id, raw_location) if safari else raw_location
            encounter_type = normalize_safari_encounter_type(region, raw_encounter_type, safari)
            common = {
                "region": region, "locationId": location_id, "location": location,
                "encounterType": encounter_type, "season": season, "safari": safari,
            }
            for time in TIMES:
                kind, rate = parse_rate(loc.get(TIME_FIELDS[time]))
                if kind == "none":
                    continue
                if kind == "special":
                    # Phenomena and other dump rows marked Special do not expose a
                    # stable numeric rate, but remain useful as a Pokédex category.
                    special_availability_by_pid[pid].add((season, time))
                    continue
                if kind == "lure":
                    lure_entries[(region, location_id, encounter_type, season, time)].add(pid)
                    continue
                if rate <= 0:
                    continue
                row = {
                    "rate": rate,
                    "minLevel": int(loc.get("min_level", 0) or 0),
                    "maxLevel": int(loc.get("max_level", 0) or 0),
                    **common, "time": time,
                }
                if loc.get("is_horde_5x") or loc.get("is_horde_3x"):
                    size = 5 if loc.get("is_horde_5x") else 3
                    key = (region, location_id, location, encounter_type, season, time, size, safari)
                    existing = horde_tables[key].get(pid)
                    if existing:
                        existing["rate"] += rate
                        existing["minLevel"] = min(existing["minLevel"], row["minLevel"])
                        existing["maxLevel"] = max(existing["maxLevel"], row["maxLevel"])
                    else:
                        horde_tables[key][pid] = row
                else:
                    key = (region, location_id, location, encounter_type, season, time, safari)
                    existing = normal_tables[key].get(pid)
                    if existing:
                        existing["rate"] += rate
                        existing["minLevel"] = min(existing["minLevel"], row["minLevel"])
                        existing["maxLevel"] = max(existing["maxLevel"], row["maxLevel"])
                    else:
                        normal_tables[key][pid] = row

    options_by_pokemon: dict[int, list[dict[str, Any]]] = defaultdict(list)
    encounter_tables: dict[str, dict[str, Any]] = {}
    table_ids_by_signature: dict[str, str] = {}
    safari_component_count = 0

    def safari_capture_for(region: str, location: str, pid: int) -> dict[str, Any] | None:
        if region == "Johto" and "Safari Zone" in location:
            source = safari_rates.get("johto", {}).get(str(pid))
            scope = "Johto Safari Zone"
        elif region == "Sinnoh" and "Great Marsh" in location:
            source = safari_rates.get("sinnoh", {}).get(str(pid))
            scope = "Sinnoh Great Marsh"
        else:
            return None
        if not source:
            return None
        return {
            "scope": scope,
            "ballsOnlySuccess": round(float(source.get("ballsOnlySuccess", 0)), 7),
            "fleePerTurn": round(float(source.get("fleePerTurn", 0)), 7),
            "catchPerBall": round(float(source.get("catchPerBall", 0)), 7),
            "fleeRate": source.get("fleeRate"),
            "catchRate": source.get("catchRate"),
        }

    def register_table(
        table: dict[int, dict[str, Any]],
        method: str,
        shown_total: float,
        raw_event_total: float,
        confidence: str,
        note: str,
        *,
        contains_random_hordes: bool = False,
    ) -> tuple[str, dict[int, dict[str, Any] | None]]:
        nonlocal safari_component_count
        sample = next(iter(table.values()))
        capture_by_pid: dict[int, dict[str, Any] | None] = {}
        components = []
        for pid, row in sorted(table.items(), key=lambda item: (-item[1]["rate"], monsters[item[0]].get("name", ""))):
            capture = safari_capture_for(row["region"], row["location"], pid) if row["safari"] else None
            capture_by_pid[pid] = capture
            if capture:
                safari_component_count += 1
            components.append({
                "pokemonId": pid,
                "name": monsters[pid].get("name", f"Pokémon {pid}"),
                "share": round(row["rate"] / shown_total, 7),
                "rawRate": round(float(row.get("eventRate", row["rate"])), 7),
                "shownWeight": round(row["rate"], 7),
                "minLevel": row["minLevel"],
                "maxLevel": row["maxLevel"],
                "abilities": abilities_by_pid.get(pid, []),
                "slowAbilities": slow_abilities_by_pid.get(pid, []),
                "selfHarmRisks": self_harm_risks_for(pid, row["minLevel"], row["maxLevel"]),
                "safariCapture": capture,
                "sources": row.get("sources", []),
            })
        safari_pool = safari_pool_metadata(
            sample["region"], sample["encounterType"], method, raw_event_total, sample["safari"]
        )
        signature_data = {
            "region": sample["region"], "locationId": sample["locationId"], "location": sample["location"],
            "encounterType": sample["encounterType"], "method": method, "safari": sample["safari"],
            "rawTableTotal": round(raw_event_total, 7), "shownTableTotal": round(shown_total, 7),
            "containsRandomHordes": contains_random_hordes,
            "confidence": confidence, "note": note,
            "components": components,
        }
        if safari_pool is not None:
            signature_data["safariPool"] = safari_pool
            signature_data["selfHarmWarningsApplicable"] = False
        signature = json.dumps(signature_data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        table_id = table_ids_by_signature.get(signature)
        if table_id is None:
            table_id = str(len(table_ids_by_signature) + 1)
            table_ids_by_signature[signature] = table_id
            encounter_tables[table_id] = signature_data
        return table_id, capture_by_pid

    def add_table_options(
        table: dict[int, dict[str, Any]],
        method: str,
        *,
        horde: bool = False,
        lure: bool = False,
        raw_event_total: float | None = None,
        confidence_override: str | None = None,
        note_override: str | None = None,
        contains_random_hordes: bool = False,
    ) -> None:
        shown_total = sum(x["rate"] for x in table.values())
        if shown_total <= 0:
            return
        event_total = raw_event_total if raw_event_total is not None else sum(float(x.get("eventRate", x["rate"])) for x in table.values())
        special = method == "Special"
        explicit_sweet = horde and next(iter(table.values()))["encounterType"] == "Sweet Scent"
        confidence, note = table_confidence(event_total, horde=horde, lure=lure, special=special, explicit_sweet=explicit_sweet)
        confidence = confidence_override or confidence
        note = note_override or note
        table_id, capture_by_pid = register_table(
            table, method, shown_total, event_total, confidence, note,
            contains_random_hordes=contains_random_hordes,
        )
        for pid, row in table.items():
            share = row["rate"] / shown_total
            options_by_pokemon[pid].append({
                "region": row["region"], "locationId": row["locationId"], "location": row["location"],
                "encounterType": row["encounterType"], "method": method, "share": round(share, 7),
                "minLevel": row["minLevel"], "maxLevel": row["maxLevel"], "rawTableTotal": round(event_total, 5),
                "shownTableTotal": round(shown_total, 5), "containsRandomHordes": contains_random_hordes,
                "confidence": confidence, "note": note,
                "availability": [{"season": row["season"], "time": row["time"]}],
                "safari": row["safari"], "tableId": table_id,
                "safariCapture": capture_by_pid.get(pid),
                **({
                    "safariPool": encounter_tables[table_id].get("safariPool"),
                    "selfHarmWarningsApplicable": False,
                } if row["safari"] else {}),
            })

    def add_contribution(
        combined: dict[int, dict[str, Any]],
        pid: int,
        row: dict[str, Any],
        event_rate: float,
        count: int,
        kind: str,
        label: str,
    ) -> None:
        if event_rate <= 0 or count <= 0:
            return
        shown_weight = event_rate * count
        source = {
            "kind": kind,
            "label": label,
            "eventRate": round(event_rate, 7),
            "count": count,
            "shownWeight": round(shown_weight, 7),
        }
        existing = combined.get(pid)
        if existing:
            existing["rate"] += shown_weight
            existing["eventRate"] += event_rate
            existing["minLevel"] = min(existing["minLevel"], row["minLevel"])
            existing["maxLevel"] = max(existing["maxLevel"], row["maxLevel"])
            existing.setdefault("sources", []).append(source)
        else:
            combined[pid] = {
                **row,
                "rate": shown_weight,
                "eventRate": event_rate,
                "sources": [source],
            }

    def matching_horde_blocks(normal_key: tuple, variant_season: str) -> list[tuple[int, dict[int, dict[str, Any]]]]:
        region, location_id, location, encounter_type, _season, time, safari = normal_key
        exact: list[tuple[int, dict[int, dict[str, Any]]]] = []
        fallback: list[tuple[int, dict[int, dict[str, Any]]]] = []
        for hkey, htable in horde_tables.items():
            hregion, hlocation_id, hlocation, htype, hseason, htime, size, hsafari = hkey
            if (hregion, hlocation_id, hlocation, htype, htime, hsafari) != (region, location_id, location, encounter_type, time, safari):
                continue
            if hseason == variant_season:
                exact.append((size, htable))
            elif hseason == "Any":
                fallback.append((size, htable))
        return exact or fallback

    def variant_seasons_for(normal_key: tuple) -> list[str]:
        region, location_id, location, encounter_type, season, time, safari = normal_key
        if season != "Any":
            return [season]
        specific = set()
        for hkey in horde_tables:
            hregion, hlocation_id, hlocation, htype, hseason, htime, _size, hsafari = hkey
            if (hregion, hlocation_id, hlocation, htype, htime, hsafari) == (region, location_id, location, encounter_type, time, safari) and hseason != "Any":
                specific.add(hseason)
        for lkey in lure_entries:
            lregion, llocation_id, ltype, lseason, ltime = lkey
            if (lregion, llocation_id, ltype, ltime) == (region, location_id, encounter_type, time) and lseason != "Any":
                specific.add(lseason)
        return list(SEASONS) if specific else ["Any"]

    def build_random_encounter_table(
        normal_table: dict[int, dict[str, Any]],
        horde_blocks: list[tuple[int, dict[int, dict[str, Any]]]],
        variant_season: str,
    ) -> tuple[dict[int, dict[str, Any]], float, bool]:
        combined: dict[int, dict[str, Any]] = {}
        raw_event_total = 0.0
        for pid, original in normal_table.items():
            row = dict(original, season=variant_season)
            event_rate = float(original["rate"])
            raw_event_total += event_rate
            add_contribution(combined, pid, row, event_rate, 1, "single", "Single encounter")
        horde_event_total = 0.0
        for size, htable in horde_blocks:
            for pid, original in htable.items():
                row = dict(original, season=variant_season)
                event_rate = float(original["rate"])
                horde_event_total += event_rate
                add_contribution(combined, pid, row, event_rate, size, "horde", f"Natural {size}× horde")
        raw_event_total += horde_event_total
        return combined, raw_event_total, horde_event_total > 0

    def build_lure_table(
        base_table: dict[int, dict[str, Any]],
        base_event_total: float,
        lure_ids: set[int],
        sample: dict[str, Any],
        variant_season: str,
    ) -> dict[int, dict[str, Any]]:
        combined: dict[int, dict[str, Any]] = {}
        if base_event_total <= 0:
            return combined
        base_scale = 0.95 / base_event_total
        for pid, row in base_table.items():
            for source in row.get("sources", []):
                event_rate = float(source["eventRate"]) * base_scale
                source_row = dict(row, season=variant_season)
                add_contribution(
                    combined, pid, source_row, event_rate, int(source.get("count", 1)),
                    str(source.get("kind", "single")), str(source.get("label", "Encounter")),
                )
        lure_share = 0.05 / len(lure_ids)
        for pid in lure_ids:
            row = {
                "minLevel": 0, "maxLevel": 0,
                "region": sample["region"], "locationId": sample["locationId"], "location": sample["location"],
                "encounterType": sample["encounterType"], "season": variant_season, "time": sample["time"], "safari": sample["safari"],
            }
            add_contribution(combined, pid, row, lure_share, 1, "lure", "Lure-exclusive encounter")
        return combined

    # Random encounter methods. The dump's hidden 5% horde block is part of ordinary
    # walking/surfing/Safari encounters; Sweet Scent extracts the same block separately.
    for key, normal_table in normal_tables.items():
        original_sample = next(iter(normal_table.values()))
        method = method_for(original_sample["encounterType"], original_sample["safari"])
        for variant_season in variant_seasons_for(key):
            horde_blocks = matching_horde_blocks(key, variant_season)
            random_table, raw_event_total, includes_hordes = build_random_encounter_table(normal_table, horde_blocks, variant_season)
            if includes_hordes:
                confidence = "High" if abs(raw_event_total - 1.0) <= 0.03 else "Medium"
                note = (
                    "Random encounter table includes the natural horde roll. "
                    "Shares are weighted by individual Pokémon shown; Sweet Scent extracts the horde block separately."
                )
            else:
                confidence, note = table_confidence(raw_event_total, special=method == "Special")
            add_table_options(
                random_table, method, raw_event_total=raw_event_total,
                confidence_override=confidence, note_override=note,
                contains_random_hordes=includes_hordes,
            )

            # Lure variant: 95% of the complete random-encounter table (including
            # natural hordes) plus a 5% lure-exclusive encounter roll.
            if method in {"Singles", "Surfing", "Safari"}:
                region, location_id, location, encounter_type, _season, time, safari = key
                lure_ids = set()
                for lure_season in (variant_season, "Any"):
                    lure_ids |= lure_entries.get((region, location_id, encounter_type, lure_season, time), set())
                if lure_ids:
                    sample = dict(original_sample, season=variant_season)
                    lure_table = build_lure_table(random_table, raw_event_total, lure_ids, sample, variant_season)
                    note = (
                        "Lure table uses 95% of the complete random-encounter table, including natural hordes, "
                        "plus a 5% lure-exclusive encounter roll. Shares are weighted by individual Pokémon shown."
                        if includes_hordes else
                        "Lure table uses 95% of the available random-encounter pool plus a 5% lure-exclusive encounter roll. "
                        "No matching natural horde block was available for this table."
                    )
                    add_table_options(
                        lure_table, method_for(encounter_type, safari, lure=True), lure=True,
                        raw_event_total=1.0, confidence_override="Medium", note_override=note,
                        contains_random_hordes=includes_hordes,
                    )

    # Sweet Scent remains a separate view of the extracted horde block.
    for key, table in horde_tables.items():
        size = key[6]
        weighted: dict[int, dict[str, Any]] = {}
        raw_event_total = 0.0
        for pid, row in table.items():
            event_rate = float(row["rate"])
            raw_event_total += event_rate
            label = f"Sweet Scent {size}× horde"
            add_contribution(weighted, pid, row, event_rate, size, "sweet-scent", label)
        add_table_options(weighted, f"{size}× Horde", horde=True, raw_event_total=raw_event_total)

    def dex_categories_for_option(pid: int, opt: dict[str, Any]) -> list[str]:
        table = encounter_tables.get(str(opt.get("tableId")), {})
        component = next((row for row in table.get("components", []) if int(row.get("pokemonId", -1)) == pid), None)
        if component is None:
            return []
        source_kinds = {str(source.get("kind", "")) for source in component.get("sources", [])}
        method = str(opt.get("method", ""))
        categories: list[str] = []
        if method in {"Lure Singles", "Lure Safari"}:
            categories.append("Lure")
        if bool(opt.get("safari")):
            categories.append("Safari")
        if method in {"5× Horde", "3× Horde"}:
            pure = len(table.get("components", [])) == 1 and abs(float(component.get("share", 0)) - 1.0) <= 0.000001
            categories.append(f"{method} · {'100%' if pure else 'Split'}")
        elif method in {"Singles", "Surfing"}:
            # Species that only occur through a natural horde inside the walking/
            # surfing table are not labelled as ordinary single encounters.
            if "single" in source_kinds:
                categories.append(method)
        elif method in {"Fishing", "Rock Smash", "Headbutt", "Honey Tree", "Special"}:
            categories.append(method)
        return categories

    # Collapse repeated availability only when the entire encounter split is identical.
    hunt_count = 0
    methods_by_pid: dict[int, set[str]] = defaultdict(set)
    availability_by_pid: dict[int, dict[str, set[tuple[str, str]]]] = defaultdict(lambda: defaultdict(set))
    dex_categories_by_pid: dict[int, set[str]] = defaultdict(set)
    category_availability_by_pid: dict[int, dict[str, set[tuple[str, str]]]] = defaultdict(lambda: defaultdict(set))
    self_harm_summary_by_pid: dict[int, dict[tuple[str, str], dict[str, Any]]] = defaultdict(dict)
    route_index_by_table: dict[str, dict[str, Any]] = {}
    for pid in monsters:
        grouped: dict[tuple, dict[str, Any]] = {}
        for opt in options_by_pokemon.get(pid, []):
            capture_sig = json.dumps(opt.get("safariCapture"), sort_keys=True)
            key = (
                opt["region"], opt["locationId"], opt["location"], opt["encounterType"], opt["method"],
                opt["share"], opt["minLevel"], opt["maxLevel"], opt["rawTableTotal"], opt["confidence"],
                opt["note"], opt["safari"], opt["tableId"], opt.get("shownTableTotal"), opt.get("containsRandomHordes"), capture_sig,
            )
            if key not in grouped:
                grouped[key] = {k: v for k, v in opt.items() if k != "availability"}
                grouped[key]["availability"] = []
            pair = opt["availability"][0]
            if pair not in grouped[key]["availability"]:
                grouped[key]["availability"].append(pair)
        collapsed = list(grouped.values())
        season_order = {s: i for i, s in enumerate((*SEASONS, "Any"))}
        time_order = {t: i for i, t in enumerate(TIMES)}
        for opt in collapsed:
            opt["availability"].sort(key=lambda x: (season_order.get(x["season"], 99), time_order.get(x["time"], 99)))
        collapsed.sort(key=lambda x: (-x["share"], x["method"], x["region"], x["location"]))
        safe_json(data_dir / "hunts" / f"{pid}.json", collapsed)
        hunt_count += len(collapsed)
        lure_exclusive_pairs: set[tuple[str, str]] = set()
        has_lure_source = False
        has_non_lure_source = False
        for opt in collapsed:
            methods_by_pid[pid].add(opt["method"])
            categories = dex_categories_for_option(pid, opt)
            table_component = next(
                (row for row in encounter_tables[str(opt["tableId"])].get("components", []) if int(row.get("pokemonId", -1)) == pid),
                None,
            )
            source_kinds = {
                str(source.get("kind", ""))
                for source in (table_component or {}).get("sources", [])
            }
            if "lure" in source_kinds:
                has_lure_source = True
                lure_exclusive_pairs.update(
                    (availability["season"], availability["time"])
                    for availability in opt["availability"]
                )
            if source_kinds - {"lure"}:
                has_non_lure_source = True
            if table_component:
                for risk in table_component.get("selfHarmRisks", []):
                    risk_key = (str(risk.get("kind", "")), str(risk.get("name", "")))
                    self_harm_summary_by_pid[pid][risk_key] = {
                        "kind": risk.get("kind"), "name": risk.get("name"),
                        "riskType": risk.get("riskType"), "description": risk.get("description"),
                    }
            for availability in opt["availability"]:
                pair = (availability["season"], availability["time"])
                availability_by_pid[pid][opt["method"]].add(pair)
                for category in categories:
                    dex_categories_by_pid[pid].add(category)
                    category_availability_by_pid[pid][category].add(pair)
            route_row = route_index_by_table.setdefault(str(opt["tableId"]), {
                "tableId": str(opt["tableId"]), "region": opt["region"], "locationId": opt["locationId"],
                "location": opt["location"], "encounterType": opt["encounterType"], "method": opt["method"],
                "safari": opt["safari"], "confidence": opt["confidence"], "rawTableTotal": opt["rawTableTotal"],
                "note": opt["note"], "shownTableTotal": opt.get("shownTableTotal"), "containsRandomHordes": opt.get("containsRandomHordes", False),
                **({
                    "safariPool": opt.get("safariPool"),
                    "selfHarmWarningsApplicable": False,
                } if opt["safari"] else {}),
                "availability": [],
            })
            for availability in opt["availability"]:
                if availability not in route_row["availability"]:
                    route_row["availability"].append(availability)

        # Globally Lure-exclusive: no normal, horde, Safari, fishing, phenomenon,
        # or other non-Lure wild source anywhere in the dump.
        if has_lure_source and not has_non_lure_source and not special_availability_by_pid.get(pid):
            dex_categories_by_pid[pid].add("Lure-exclusive")
            category_availability_by_pid[pid]["Lure-exclusive"].update(lure_exclusive_pairs)

        # "Special" includes phenomena and every dump row whose rarity is marked
        # Special (for example rustling grass, rippling water, shadows or dust clouds).
        if special_availability_by_pid.get(pid):
            dex_categories_by_pid[pid].add("Special")
            category_availability_by_pid[pid]["Special"].update(special_availability_by_pid[pid])

        if pid in FOSSIL_SPECIES:
            dex_categories_by_pid[pid].add("Fossil")
            category_availability_by_pid[pid]["Fossil"].update(("Any", time) for time in TIMES)

    for entry in index:
        pid = entry["id"]
        entry["methods"] = sorted(methods_by_pid.get(pid, set()))
        entry["methodAvailability"] = {
            method: [
                {"season": season, "time": time}
                for season, time in sorted(
                    pairs,
                    key=lambda pair: (season_order.get(pair[0], 99), time_order.get(pair[1], 99)),
                )
            ]
            for method, pairs in sorted(availability_by_pid.get(pid, {}).items())
        }
        entry["dexCategories"] = sorted(
            dex_categories_by_pid.get(pid, set()),
            key=lambda category: (DEX_CATEGORY_ORDER.get(category, 999), category),
        )
        search_categories = set(entry["dexCategories"])
        if "5× Horde · 100%" in search_categories:
            search_categories.discard("5× Horde · Split")
        if "3× Horde · 100%" in search_categories:
            search_categories.discard("3× Horde · Split")
        entry["dexSearchCategories"] = sorted(
            search_categories,
            key=lambda category: (DEX_CATEGORY_ORDER.get(category, 999), category),
        )
        entry["categoryAvailability"] = {
            category: [
                {"season": season, "time": time}
                for season, time in sorted(
                    pairs,
                    key=lambda pair: (season_order.get(pair[0], 99), time_order.get(pair[1], 99)),
                )
            ]
            for category, pairs in sorted(
                category_availability_by_pid.get(pid, {}).items(),
                key=lambda row: (DEX_CATEGORY_ORDER.get(row[0], 999), row[0]),
            )
        }
        entry["wildSelfHarmRisks"] = sorted(
            self_harm_summary_by_pid.get(pid, {}).values(),
            key=lambda risk: (risk.get("kind") != "move", risk.get("name", "")),
        )
    safe_json(data_dir / "index.json", index)
    route_index = list(route_index_by_table.values())
    for row in route_index:
        row["availability"].sort(key=lambda x: (season_order.get(x["season"], 99), time_order.get(x["time"], 99)))
    route_index.sort(key=lambda x: (x["region"], x["location"], x["method"], int(x["tableId"])))
    safe_json(data_dir / "route-index.json", route_index)
    safe_json(data_dir / "encounter-tables.json", encounter_tables)
    safe_json(data_dir / "phase-previews.json", {
        str(table_id): [
            {
                "pokemonId": int(component["pokemonId"]),
                "name": component["name"],
                "share": round(float(component["share"]), 7),
                "selfHarmRisks": component.get("selfHarmRisks", []),
            }
            for component in table.get("components", [])
        ]
        for table_id, table in encounter_tables.items()
    })

    methods = [
        {"id": "5× Horde", "label": "5× Horde", "defaultEph": 1200},
        {"id": "3× Horde", "label": "3× Horde", "defaultEph": 720},
        {"id": "Lure Singles", "label": "Lure Singles", "defaultEph": 280},
        {"id": "Lure Safari", "label": "Lure Safari", "defaultEph": 300},
        {"id": "Singles", "label": "Singles", "defaultEph": 220},
        {"id": "Surfing", "label": "Surfing", "defaultEph": 220},
        {"id": "Safari", "label": "Safari", "defaultEph": 300},
        {"id": "Fishing", "label": "Fishing", "defaultEph": 270},
        {"id": "Rock Smash", "label": "Rock Smash", "defaultEph": 120},
        {"id": "Headbutt", "label": "Headbutt", "defaultEph": 120},
        {"id": "Honey Tree", "label": "Honey Tree", "defaultEph": 0},
        {"id": "Special", "label": "Special", "defaultEph": 0},
    ]
    safe_json(data_dir / "methods.json", methods)
    safe_json(data_dir / "dex-categories.json", DEX_CATEGORY_DEFS)

    summary = {
        "pokemon": len(index), "huntOptions": hunt_count, "encounterTables": len(encounter_tables),
        "safariRateComponents": safari_component_count, "routeTables": len(route_index), "sprites": sprite_counts,
        "itemSprites": item_sprite_count, "source": "dump.zip", "version": "0.22",
    }
    safe_json(data_dir / "build-info.json", summary)
    return summary

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dump_zip", type=Path)
    parser.add_argument("project_root", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if not args.dump_zip.exists():
        print(f"Dump not found: {args.dump_zip}", file=sys.stderr)
        return 1
    summary = build(args.dump_zip.resolve(), args.project_root.resolve())
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
