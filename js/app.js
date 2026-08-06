const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  pokemon: [],
  pokemonById: new Map(),
  pokemonBySlug: new Map(),
  methods: [],
  dexCategories: [],
  buildInfo: null,
  detailCache: new Map(),
  huntCache: new Map(),
  encounterTables: null,
  phasePreviews: null,
  routeIndex: null,
  trainingIndex: null,
  activeHuntMap: new Map(),
  dexPage: 1,
  dexFilters: { query: "", category: "All", season: "All", time: "All", generation: "All", availability: "Obtainable" },
  routeFilters: { region: "", location: "", method: "", season: "All", time: "All" },
  trainingFilters: { mode: "ev", stat: "HP", region: "All", season: "All", time: "All" },
  trainingVisible: 40,
  hunterFilters: { method: "All", region: "All", season: "All", time: "All", confidence: "All" },
  hunterSelectedId: null,
  hunterPickerOutsideHandler: null,
};

const STORAGE = {
  settings: "paxdex.settings.v2",
  favorites: "paxdex.favorites.v2",
  recent: "paxdex.recent.v2",
};
const LEGACY_STORAGE = {
  settings: "pocketdex.settings.v1",
  favorites: "pocketdex.favorites.v1",
  recent: "pocketdex.recent.v1",
};

const defaultSettings = () => ({
  settingsVersion: 6,
  baseShinyDenominator: 30000,
  donatorStatus: false,
  shinyCharm: 0,
  eventBonus: 0,
  shinySprites: false,
  theme: "light",
  lockSeason: false,
  currentSeason: "All",
  lockTime: false,
  currentTime: "All",
  adjustSafariCatch: true,
  hunterTargetMode: "exact",
  speeds: Object.fromEntries(state.methods.map(m => [m.id, m.defaultEph])),
});

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function settings() {
  const base = defaultSettings();
  const legacy = readJSON(LEGACY_STORAGE.settings, {});
  const stored = readJSON(STORAGE.settings, {});
  const merged = { ...base, ...legacy, ...stored, speeds: { ...base.speeds, ...(legacy.speeds || {}), ...(stored.speeds || {}) } };
  if (!("baseShinyDenominator" in stored) && !("baseShinyDenominator" in legacy) && legacy.shinyDenominator != null) merged.baseShinyDenominator = legacy.shinyDenominator;

  // Preserve custom values while migrating new defaults and settings once.
  const sourceVersion = Number(stored.settingsVersion || legacy.settingsVersion || 0);
  if (sourceVersion < 3) {
    const oldSpeeds = { ...(legacy.speeds || {}), ...(stored.speeds || {}) };
    if (!("5× Horde" in oldSpeeds) || Number(oldSpeeds["5× Horde"]) === 1000) merged.speeds["5× Horde"] = 1200;
    if (!("3× Horde" in oldSpeeds) || Number(oldSpeeds["3× Horde"]) === 600) merged.speeds["3× Horde"] = 720;
  }
  if (sourceVersion < 4) {
    if (!("adjustSafariCatch" in stored) && !("adjustSafariCatch" in legacy)) merged.adjustSafariCatch = true;
  }
  if (sourceVersion < 5) {
    if (!("hunterTargetMode" in stored) && !("hunterTargetMode" in legacy)) merged.hunterTargetMode = "exact";
  }
  if (sourceVersion < 6) {
    const oldSpeeds = { ...(legacy.speeds || {}), ...(stored.speeds || {}) };
    const inheritedFishingSpeed = Number(oldSpeeds.Fishing ?? merged.speeds.Fishing ?? 270);
    for (const rod of ["Old Rod", "Good Rod", "Super Rod"]) {
      if (!(rod in oldSpeeds)) merged.speeds[rod] = inheritedFishingSpeed;
    }
    merged.settingsVersion = 6;
    if (Object.keys(stored).length || Object.keys(legacy).length) saveJSON(STORAGE.settings, merged);
  }
  return merged;
}
function favorites() {
  const current = readJSON(STORAGE.favorites, null);
  return new Set(current ?? readJSON(LEGACY_STORAGE.favorites, []));
}
function recent() {
  const current = readJSON(STORAGE.recent, null);
  return current ?? readJSON(LEGACY_STORAGE.recent, []);
}

function effectiveShinyDenominator(s = settings()) {
  let denominator = Math.max(1, Number(s.baseShinyDenominator) || 30000);
  if (s.donatorStatus) denominator *= 0.90;
  denominator *= 1 - Math.max(0, Math.min(0.99, Number(s.shinyCharm) || 0));
  denominator *= 1 - Math.max(0, Math.min(0.99, Number(s.eventBonus) || 0));
  return denominator;
}
function shinyFormula(s = settings()) {
  const parts = [Number(s.baseShinyDenominator) || 30000];
  if (s.donatorStatus) parts.push(0.90);
  if (Number(s.shinyCharm)) parts.push(1 - Number(s.shinyCharm));
  if (Number(s.eventBonus)) parts.push(1 - Number(s.eventBonus));
  return parts.map((x, i) => i ? x.toFixed(2) : Number(x).toLocaleString()).join(" × ");
}
function resolvedTheme(theme = settings().theme) {
  if (theme === "system") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return theme === "dark" ? "dark" : "light";
}
function applyTheme(theme = settings().theme) {
  const resolved = resolvedTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "dark" ? "#111b18" : "#2d6a4f";
  const btn = $("#theme-toggle");
  if (btn) {
    btn.textContent = resolved === "dark" ? "☀" : "☾";
    btn.title = resolved === "dark" ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", btn.title);
  }
}
function toggleTheme() {
  const s = settings();
  s.theme = resolvedTheme(s.theme) === "dark" ? "light" : "dark";
  saveJSON(STORAGE.settings, s);
  applyTheme(s.theme);
}

const SEASON_ICONS = {
  Spring: "assets/icons/season-spring.png",
  Summer: "assets/icons/season-summer.png",
  Autumn: "assets/icons/season-autumn.png",
  Winter: "assets/icons/season-winter.png",
};
const TIME_ICONS = {
  Morning: "assets/icons/time-morning.png",
  Day: "assets/icons/time-day.png",
  Night: "assets/icons/time-night.png",
};
function filterIcon(kind, value, className = "") {
  const src = kind === "season" ? SEASON_ICONS[value] : TIME_ICONS[value];
  return src ? `<img class="filter-symbol ${className}" src="${src}" alt="" aria-hidden="true">` : `<span class="all-symbol" aria-hidden="true">✦</span>`;
}
function iconChoiceGroup(kind, values, current, name) {
  return `<div class="icon-choice-group" role="group" aria-label="${escapeHtml(name)}">${values.map(value => `<button type="button" class="icon-choice ${value === current ? "active" : ""}" data-${kind}-choice="${value}" aria-pressed="${value === current}">${filterIcon(kind, value)}<span>${value}</span></button>`).join("")}</div>`;
}
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function dailyPokemon() {
  const pool = state.pokemon.filter(p => p.obtainable);
  const key = localDateKey();
  let hash = 2166136261;
  for (const char of key) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return pool[Math.abs(hash >>> 0) % pool.length] || state.pokemon[0];
}

function spritePath(id, shiny = false, icon = false) {
  if (icon) return `sprites/${shiny ? "icons-shiny" : "icons"}/${id}.png`;
  return `sprites/${shiny ? "shiny" : "normal"}/${id}.png`;
}
function placeholder(id, name) {
  return `<div class="sprite-placeholder" aria-label="No sprite for ${escapeHtml(name)}">#${String(id).padStart(3, "0")}</div>`;
}
function imageTag(id, name, { shiny = false, icon = false, className = "" } = {}) {
  const src = spritePath(id, shiny, icon);
  return `<img class="${className}" src="${src}" alt="${shiny ? "Shiny " : ""}${escapeHtml(name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sprite-placeholder',textContent:'#${String(id).padStart(3,"0")}'}))">`;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[c]));
}
function typeBadge(type) { return `<span class="type-badge type-${type.toLowerCase()}">${escapeHtml(type)}</span>`; }
function typeBadges(types = []) {
  return [...new Set(types.filter(Boolean))].map(typeBadge).join("");
}

const SAFETY_SEVERITY_ORDER = { critical: 0, warning: 1, preparation: 2 };
function safetyRiskText(risks = []) {
  if (!risks.length) return "";
  return risks.map(risk => {
    const levelText = risk.levels ? ` · Lv. ${risk.levels}` : "";
    const categoryText = risk.category ? ` · ${risk.category}` : "";
    const preparation = risk.preparation ? ` Preparation: ${risk.preparation}` : "";
    return `${risk.name}${levelText}${categoryText}: ${risk.description || "Can endanger a shiny encounter."}${preparation}`;
  }).join(" | ");
}
function safetySeverity(risks = []) {
  return [...risks].sort((a, b) => (SAFETY_SEVERITY_ORDER[a.severity] ?? 99) - (SAFETY_SEVERITY_ORDER[b.severity] ?? 99))[0]?.severity || "warning";
}
function safetyWarning(risks = [], { compact = false } = {}) {
  if (!risks.length) return "";
  const severity = safetySeverity(risks);
  const title = `Wild encounter safety · ${safetyRiskText(risks)}`;
  const icon = severity === "critical" ? "!" : severity === "preparation" ? "i" : "⚠";
  return `<span class="wild-risk-marker severity-${severity} ${compact ? "compact" : ""}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span aria-hidden="true">${icon}</span>${compact ? "" : "<b>Safety</b>"}</span>`;
}
function safetyWarningsEnabled(value = {}) {
  return value.safetyWarningsApplicable !== false && value.selfHarmWarningsApplicable !== false;
}
function safetyRiskRows(risks = []) {
  if (!risks.length) return "";
  return `<div class="split-safety-list">${risks.map(risk => {
    const levelText = risk.levels ? ` · Lv. ${risk.levels}` : "";
    return `<div class="split-safety-row severity-${escapeHtml(risk.severity || "warning")}"><strong>${escapeHtml(risk.name)}${escapeHtml(levelText)}</strong><span>${escapeHtml(risk.category || "Encounter safety")}</span><p>${escapeHtml(risk.description || "This can endanger the encounter.")}</p>${risk.preparation ? `<small><b>Prepare:</b> ${escapeHtml(risk.preparation)}</small>` : ""}</div>`;
  }).join("")}</div>`;
}

function generationFor(id) {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  return 5;
}
function generationLabel(id) { return `Gen ${["", "I", "II", "III", "IV", "V"][generationFor(id)]}`; }
function typeThemeClass(types = []) {
  const primary = String(types.find(Boolean) || "normal").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `type-theme-${primary || "normal"}`;
}
function itemImageTag(item) {
  const id = Number(item?.id);
  if (!Number.isFinite(id)) return "";
  return `<img class="item-icon" src="sprites/items/${id}.png" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()">`;
}
function formatNumber(n, digits = 1) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function formatPercent(n, digits = 1) { return `${formatNumber(n * 100, digits)}%`; }
function formatRate(n) {
  const value = Number(n) || 0;
  if (value >= 100) return formatNumber(value, 0);
  if (value >= 1) return formatNumber(value, 1);
  return formatNumber(value, 2);
}
function setPageTitle(label = "") {
  document.title = label ? `${label} · PaxDex` : "PaxDex · PokeMMO Field Guide";
}
function hoursLabel(hours) {
  if (!Number.isFinite(hours)) return "—";
  if (hours >= 1000) return `${Math.round(hours).toLocaleString()} h`;
  return `${formatNumber(hours, hours < 10 ? 1 : 0)} h`;
}
function confidenceClass(c) { return `confidence-${String(c).toLowerCase()}`; }
function safariPoolTitle(row = {}) {
  const pool = row.safariPool;
  if (!pool) return "";
  const coverage = Number(pool.documentedTotal || 0);
  const lureText = pool.lureModel ? " The Lure model is applied to this documented base pool." : "";
  return `${pool.note || "Safari source coverage."}${lureText}${coverage ? ` Coverage: ${formatPercent(coverage, 0)}.` : ""}`;
}
function encounterQualityBadge(row = {}, { chip = false } = {}) {
  const pool = row.safariPool;
  if (pool?.status === "partial") {
    const text = `${pool.label || "Base pool"} · ${formatPercent(Number(pool.documentedTotal || 0), 0)}`;
    return `<span class="${chip ? "chip " : "confidence "}safari-pool-badge" title="${escapeHtml(safariPoolTitle(row))}">${escapeHtml(text)}</span>`;
  }
  return `<span class="${chip ? "chip " : "confidence "}${confidenceClass(row.confidence)}">${escapeHtml(row.confidence)} confidence</span>`;
}
function routeTableStatus(row = {}) {
  const pool = row.safariPool;
  if (pool?.status === "partial") {
    const model = pool.lureModel ? " · Lure model" : "";
    return `<span>${escapeHtml(pool.label || "Base pool")}${model}</span><span>${formatPercent(Number(pool.documentedTotal || 0), 0)} documented</span>`;
  }
  return `<span>${escapeHtml(row.confidence)} confidence</span><span>${row.containsRandomHordes ? "Includes natural horde roll" : `Raw ${formatPercent(row.rawTableTotal,row.rawTableTotal<.1?1:0)}`}</span>`;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}
async function getDetail(id) {
  if (!state.detailCache.has(id)) state.detailCache.set(id, fetchJSON(`data/pokemon/${id}.json`));
  return state.detailCache.get(id);
}
async function getHunts(id) {
  if (!state.huntCache.has(id)) state.huntCache.set(id, fetchJSON(`data/hunts/${id}.json`));
  return state.huntCache.get(id);
}
function normalizedTargetMode(value) { return value === "line" ? "line" : "exact"; }
function targetModeControl(current, label = "Target scope") {
  const mode = normalizedTargetMode(current);
  return `<div class="target-mode-control" role="group" aria-label="${escapeHtml(label)}">
    <button type="button" class="target-mode-button ${mode === "exact" ? "active" : ""}" data-target-mode="exact" aria-pressed="${mode === "exact"}">Exact form</button>
    <button type="button" class="target-mode-button ${mode === "line" ? "active" : ""}" data-target-mode="line" aria-pressed="${mode === "line"}">Evolution line</button>
  </div>`;
}
function addTargetMembers(hunts, pokemon) {
  return hunts.map(hunt => ({
    ...hunt,
    targetMembers: [{ pokemonId: pokemon.id, name: pokemon.name, share: Number(hunt.share || 0), safariCapture: hunt.safariCapture || null }],
  }));
}
function combineEvolutionLineHunts(targetPokemon, huntGroups) {
  const byTable = new Map();
  huntGroups.forEach((hunts, index) => {
    const pokemon = targetPokemon[index];
    hunts.forEach(hunt => {
      const key = String(hunt.tableId);
      if (!byTable.has(key)) {
        byTable.set(key, { ...hunt, share: 0, safariCapture: null, targetMembers: [] });
      }
      const combined = byTable.get(key);
      combined.share += Number(hunt.share || 0);
      combined.minLevel = combined.minLevel && hunt.minLevel ? Math.min(combined.minLevel, hunt.minLevel) : (combined.minLevel || hunt.minLevel || 0);
      combined.maxLevel = Math.max(Number(combined.maxLevel || 0), Number(hunt.maxLevel || 0));
      combined.targetMembers.push({
        pokemonId: pokemon.id, name: pokemon.name, share: Number(hunt.share || 0), safariCapture: hunt.safariCapture || null,
      });
    });
  });
  return [...byTable.values()].map(hunt => ({ ...hunt, share: Math.min(1, hunt.share) }));
}
async function loadHunterTarget(id, mode) {
  const selected = state.pokemonById.get(id);
  const normalizedMode = normalizedTargetMode(mode);
  if (!selected) return null;
  if (normalizedMode === "exact") {
    return { selected, targetPokemon: [selected], targetIds: [selected.id], hunts: addTargetMembers(await getHunts(selected.id), selected), mode: "exact" };
  }
  const detail = await getDetail(selected.id);
  const targetPokemon = (detail.evolutionLine || [selected.id]).map(pid => state.pokemonById.get(Number(pid))).filter(Boolean);
  const huntGroups = await Promise.all(targetPokemon.map(mon => getHunts(mon.id)));
  return { selected, targetPokemon, targetIds: targetPokemon.map(mon => mon.id), hunts: combineEvolutionLineHunts(targetPokemon, huntGroups), mode: "line" };
}
function targetMemberBreakdown(hunt, speed, { compact = false } = {}) {
  const members = (hunt.targetMembers || []).filter(member => Number(member.share || 0) > 0);
  if (members.length <= 1) return "";
  const visible = members.map(member => `${escapeHtml(member.name)} ${formatRate(Number(speed || 0) * Number(member.share || 0))}/hr`);
  return `<div class="target-member-breakdown ${compact ? "compact" : ""}">${visible.join(`<span aria-hidden="true">·</span>`)}</div>`;
}
async function getEncounterTables() {
  if (!state.encounterTables) state.encounterTables = await fetchJSON("data/encounter-tables.json");
  return state.encounterTables;
}
async function getPhasePreviews() {
  if (!state.phasePreviews) state.phasePreviews = await fetchJSON("data/phase-previews.json");
  return state.phasePreviews;
}
async function getRouteIndex() {
  if (!state.routeIndex) state.routeIndex = await fetchJSON("data/route-index.json");
  return state.routeIndex;
}
async function getTrainingIndex() {
  if (!state.trainingIndex) state.trainingIndex = await fetchJSON("data/training-index.json");
  return state.trainingIndex;
}

function setActiveNav(route) {
  $$("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === route));
}
function routeParts() {
  const raw = location.hash.replace(/^#/, "") || "home";
  return raw.split("/");
}
function go(hash) { location.hash = hash; }
function appFocus() { requestAnimationFrame(() => $("#app")?.focus({ preventScroll: true })); }

function toast(message) {
  $(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

function toggleFavorite(id) {
  const set = favorites();
  if (set.has(id)) { set.delete(id); toast("Removed from favorites"); }
  else { set.add(id); toast("Saved to favorites"); }
  saveJSON(STORAGE.favorites, [...set]);
  renderRoute();
}
function addRecent(id) {
  const items = recent().filter(x => x !== id);
  items.unshift(id);
  saveJSON(STORAGE.recent, items.slice(0, 8));
}

function pokemonSlug(pokemonOrName) {
  const name = typeof pokemonOrName === "object"
    ? pokemonOrName?.name
    : state.pokemonById.get(Number(pokemonOrName))?.name || String(pokemonOrName || "");
  return String(name)
    .normalize("NFKD")
    .replace(/♀/g, " f")
    .replace(/♂/g, " m")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
function pokemonPath(pokemonOrId) {
  const pokemon = typeof pokemonOrId === "object" ? pokemonOrId : state.pokemonById.get(Number(pokemonOrId));
  return pokemon ? `pokemon/${pokemonSlug(pokemon)}` : "pokemon";
}
function pokemonHref(pokemonOrId) { return `#${pokemonPath(pokemonOrId)}`; }
function hunterPath(pokemonOrId) {
  const pokemon = typeof pokemonOrId === "object" ? pokemonOrId : state.pokemonById.get(Number(pokemonOrId));
  return pokemon ? `hunter/${pokemonSlug(pokemon)}` : "hunter";
}
function hunterHref(pokemonOrId) { return `#${hunterPath(pokemonOrId)}`; }
function resolvePokemonRoute(value) {
  const raw = decodeURIComponent(String(value || "")).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return state.pokemonById.get(Number(raw)) || null;
  return state.pokemonBySlug.get(raw.toLowerCase()) || null;
}
function findPokemon(query, pool = state.pokemon) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  const exact = pool.find(p => p.name.toLowerCase() === q || pokemonSlug(p) === q || String(p.id) === q.replace(/^#/, ""));
  return exact || pool.find(p => p.name.toLowerCase().includes(q));
}
function evolutionRootId(pokemonOrId) {
  const pokemon = typeof pokemonOrId === "object" ? pokemonOrId : state.pokemonById.get(Number(pokemonOrId));
  return Number(pokemon?.evolutionRootId || pokemon?.id || 0);
}
function hunterPickerPool(mode = settings().hunterTargetMode) {
  const pool = state.pokemon.filter(p => p.hasLocations);
  if (normalizedTargetMode(mode) !== "line") return pool;
  return pool.filter(p => p.id === evolutionRootId(p) && (p.evolutionLine || [p.id]).some(id => state.pokemonById.get(Number(id))?.hasLocations));
}
function normalizedHunterSelection(id, mode = settings().hunterTargetMode) {
  const pokemon = state.pokemonById.get(Number(id));
  if (!pokemon) return null;
  return normalizedTargetMode(mode) === "line" ? evolutionRootId(pokemon) : pokemon.id;
}
function pickerCandidateMembers(pokemon, mode) {
  if (normalizedTargetMode(mode) !== "line") return [pokemon];
  return (pokemon.evolutionLine || [pokemon.id]).map(id => state.pokemonById.get(Number(id))).filter(Boolean);
}
function pickerMatchScore(pokemon, query, mode) {
  const q = String(query || "").trim().toLowerCase();
  const number = q.replace(/^#/, "");
  let best = null;
  pickerCandidateMembers(pokemon, mode).forEach(member => {
    const name = member.name.toLowerCase();
    let score = Infinity;
    if (String(member.id) === number || name === q) score = 0;
    else if (name.startsWith(q) || String(member.id).startsWith(number)) score = 1;
    else if (name.split(/[^a-z0-9]+/).some(part => part.startsWith(q))) score = 2;
    else if (name.includes(q) || String(member.id).includes(number)) score = 3;
    if (!best || score < best.score || (score === best.score && member.id < best.member.id)) best = { score, member };
  });
  return best && Number.isFinite(best.score) ? best : null;
}
function hunterPickerSearchResults(query, mode) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return hunterPickerPool(mode)
    .map(pokemon => ({ pokemon, match: pickerMatchScore(pokemon, q, mode) }))
    .filter(result => result.match)
    .sort((a, b) => a.match.score - b.match.score || a.pokemon.id - b.pokemon.id)
    .slice(0, 18);
}
function hunterPickerGroups(query, mode) {
  const q = String(query || "").trim();
  if (q) return [{ label: "Search results", items: hunterPickerSearchResults(q, mode) }];

  const pool = hunterPickerPool(mode).slice().sort((a, b) => a.id - b.id);
  const poolIds = new Set(pool.map(p => p.id));
  const used = new Set();
  const normalizeIds = ids => [...new Set(ids.map(id => normalizedHunterSelection(id, mode)).filter(id => id && poolIds.has(id)))];
  const favoriteIds = normalizeIds([...favorites()]);
  const recentIds = normalizeIds(recent()).filter(id => !favoriteIds.includes(id));
  const toItems = ids => ids.map(id => ({ pokemon: state.pokemonById.get(id), match: null })).filter(item => item.pokemon);
  const groups = [];
  if (favoriteIds.length) {
    const items = toItems(favoriteIds.slice(0, 5)); items.forEach(item => used.add(item.pokemon.id));
    groups.push({ label: "Favorites", items });
  }
  if (recentIds.length) {
    const items = toItems(recentIds.slice(0, 5)); items.forEach(item => used.add(item.pokemon.id));
    groups.push({ label: "Recently viewed", items });
  }
  const browse = pool.filter(p => !used.has(p.id)).map(pokemon => ({ pokemon, match: null }));
  groups.push({ label: normalizedTargetMode(mode) === "line" ? "Evolution lines · Pokédex order" : "Pokédex order", items: browse });
  return groups;
}
function hunterPickerMarkup(selected, mode) {
  const lineMode = normalizedTargetMode(mode) === "line";
  const lineCount = selected ? (selected.evolutionLine || [selected.id]).length : 0;
  return `<div class="pokemon-picker" id="hunter-picker">
    <form class="pokemon-picker-bar" id="hunter-search">
      <div class="pokemon-picker-input">
        ${selected ? imageTag(selected.id, selected.name, { icon:true, className:"picker-selected-icon" }) : '<span class="picker-search-icon" aria-hidden="true">⌕</span>'}
        <input id="hunter-pokemon-input" name="pokemon" autocomplete="off" value="${selected ? escapeHtml(selected.name) : ""}" placeholder="Search a Pokémon or Pokédex number…" aria-label="Choose a Pokémon" aria-controls="hunter-picker-results" aria-expanded="false">
        ${selected ? '<button class="picker-clear" id="hunter-picker-clear" type="button" aria-label="Clear selected Pokémon">×</button>' : ""}
      </div>
      <button class="pixel-btn" type="submit" ${selected ? "" : "disabled"}>${selected ? "Compare routes" : "Select a Pokémon"}</button>
    </form>
    <div class="pokemon-picker-results" id="hunter-picker-results" role="listbox" hidden></div>
    ${selected ? `<div class="selected-target-summary ${typeThemeClass(selected.types)}"><span>${lineMode ? "Evolution line" : "Exact form"}</span><strong>${escapeHtml(selected.name)}${lineMode && lineCount > 1 ? ` · ${lineCount} forms` : ""}</strong><small>${lineMode ? "Only base forms are listed while evolution-line mode is active." : `${generationLabel(selected.id)} · ${(selected.methods || []).length} wild methods`}</small></div>` : `<p class="picker-hint">${lineMode ? "Choose the base form of an evolution line." : "Start typing to search all wild Pokémon."}</p>`}
  </div>`;
}
function bindHunterPicker(mode) {
  const input = $("#hunter-pokemon-input");
  const results = $("#hunter-picker-results");
  const form = $("#hunter-search");
  const picker = $("#hunter-picker");
  if (!input || !results || !form || !picker) return;
  let activeIndex = -1;

  const closeResults = () => {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };
  const optionButtons = () => $$('[data-picker-pokemon]', results);
  const setActive = index => {
    const buttons = optionButtons();
    if (!buttons.length) return;
    activeIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, i) => {
      const active = i === activeIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const active = buttons[activeIndex];
    input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  };
  const choose = id => {
    state.hunterSelectedId = normalizedHunterSelection(Number(id), mode);
    renderHunter();
  };
  const renderMatches = () => {
    const groups = hunterPickerGroups(input.value, mode);
    const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0);
    let optionIndex = 0;
    results.innerHTML = itemCount ? groups.map(group => `<section class="picker-result-group" aria-label="${escapeHtml(group.label)}">
      <div class="picker-result-heading">${escapeHtml(group.label)}</div>
      ${group.items.map(({ pokemon:p, match }) => {
        const lineCount = (p.evolutionLine || [p.id]).length;
        const matchedEvolution = normalizedTargetMode(mode) === "line" && match?.member && match.member.id !== p.id ? ` · matches ${escapeHtml(match.member.name)}` : "";
        const id = `hunter-picker-option-${optionIndex++}`;
        return `<button id="${id}" class="pokemon-picker-option" type="button" role="option" aria-selected="false" data-picker-pokemon="${p.id}">
          ${imageTag(p.id, p.name, { icon:true })}
          <span><strong>${escapeHtml(p.name)}</strong><small>#${String(p.id).padStart(3,"0")} · ${normalizedTargetMode(mode) === "line" ? `${lineCount} ${lineCount === 1 ? "form" : "forms"}${matchedEvolution}` : generationLabel(p.id)}</small></span>
          <span class="picker-types">${typeBadges(p.types)}</span>
        </button>`;
      }).join("")}
    </section>`).join("") : '<div class="picker-empty">No wild Pokémon found.</div>';
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    activeIndex = -1;
  };

  input.addEventListener("focus", () => { if (state.hunterSelectedId) input.select(); renderMatches(); });
  input.addEventListener("input", () => {
    const exact = hunterPickerSearchResults(input.value, mode).find(result => result.match.score === 0);
    state.hunterSelectedId = exact ? exact.pokemon.id : null;
    form.querySelector('button[type="submit"]').disabled = !state.hunterSelectedId;
    renderMatches();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeResults(); input.blur(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); if (results.hidden) renderMatches(); setActive(activeIndex + 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); if (results.hidden) renderMatches(); setActive(activeIndex - 1); return; }
    if (event.key === "Enter" && !results.hidden && activeIndex >= 0) {
      event.preventDefault();
      choose(optionButtons()[activeIndex].dataset.pickerPokemon);
      return;
    }
    if (event.key === "Enter" && !state.hunterSelectedId) {
      const first = hunterPickerSearchResults(input.value, mode)[0]?.pokemon || hunterPickerGroups(input.value, mode).flatMap(group => group.items)[0]?.pokemon;
      if (first) { event.preventDefault(); choose(first.id); }
    }
  });
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-picker-pokemon]");
    if (button) choose(button.dataset.pickerPokemon);
  });
  results.addEventListener("mousemove", event => {
    const button = event.target.closest("[data-picker-pokemon]");
    if (!button) return;
    const index = optionButtons().indexOf(button);
    if (index >= 0 && index !== activeIndex) setActive(index);
  });
  picker.addEventListener("focusout", () => setTimeout(() => {
    if (!picker.contains(document.activeElement) && !results.matches(":hover")) closeResults();
  }, 0));

  if (state.hunterPickerOutsideHandler) document.removeEventListener("pointerdown", state.hunterPickerOutsideHandler);
  state.hunterPickerOutsideHandler = event => {
    const currentPicker = $("#hunter-picker");
    if (currentPicker && !currentPicker.contains(event.target)) closeResults();
  };
  document.addEventListener("pointerdown", state.hunterPickerOutsideHandler);

  $("#hunter-picker-clear")?.addEventListener("click", () => { state.hunterSelectedId = null; renderHunter(); });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const chosen = state.hunterSelectedId || hunterPickerSearchResults(input.value, mode)[0]?.pokemon.id;
    if (chosen) go(hunterPath(chosen)); else toast("Choose a Pokémon first");
  });
}

function orderedMethods(methods = []) {
  const order = new Map(state.methods.map((method, index) => [method.id, index]));
  return [...new Set(methods.filter(Boolean))].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b));
}
function pokemonCard(p, { shiny = settings().shinySprites, target = "pokemon" } = {}) {
  const fav = favorites().has(p.id);
  const allCategories = p.dexCategories || [];
  const categories = allCategories.slice(0, 2);
  const extraCategories = Math.max(0, allCategories.length - categories.length);
  const risks = p.wildSafetyRisks || [];
  return `<article class="pokemon-card ${typeThemeClass(p.types)}" data-pokemon-id="${p.id}">
    <a class="pokemon-card-link" href="${target === "pokemon" ? pokemonHref(p) : target === "hunter" ? hunterHref(p) : `#${target}/${p.id}`}" aria-label="Open ${escapeHtml(p.name)} ${target === "hunter" ? "in Shiny Hunter" : "Pokédex entry"}"></a>
    <div class="pokemon-card-top"><span class="number">#${String(p.id).padStart(3, "0")}</span><span class="generation-tag">${generationLabel(p.id)}</span>${safetyWarning(risks,{compact:true})}</div>
    <button class="favorite-star ${fav ? "on" : ""}" type="button" data-favorite="${p.id}" aria-label="${fav ? "Remove" : "Add"} ${escapeHtml(p.name)} ${fav ? "from" : "to"} favorites">★</button>
    <div class="sprite-box">${imageTag(p.id, p.name, { shiny, icon: true })}</div>
    <div class="pokemon-card-copy"><h3>${escapeHtml(p.name)}</h3><div class="type-row">${typeBadges(p.types)}</div></div>
    <div class="pokemon-card-foot" ${allCategories.length ? `title="${escapeHtml(allCategories.join(", "))}" aria-label="Encounter categories: ${escapeHtml(allCategories.join(", "))}"` : ""}>${categories.length ? categories.map(category => `<span>${escapeHtml(category)}</span>`).join("") + (extraCategories ? `<span>+${extraCategories}</span>` : "") : '<span>No wild route</span>'}</div>
  </article>`;
}

function renderHome() {
  setActiveNav("home");
  setPageTitle();
  const featured = dailyPokemon();
  const recentMons = recent().map(id => state.pokemonById.get(id)).filter(Boolean);
  $("#app").innerHTML = `<section class="hero">
    <div class="hero-copy">
      <span class="eyebrow">PokeMMO encounter field guide</span>
      <h1>Find a Pokémon.<br><span>Find its best hunt.</span></h1>
      <p>A compact field guide built around one question: where and when should I hunt this Pokémon? Browse clean species pages, inspect exact encounter splits, compare shiny routes, or find pure EV and high-yield EXP hordes.</p>
      <form class="search-panel" id="home-search">
        <input name="pokemon" list="pokemon-list" autocomplete="off" placeholder="Search Bulbasaur, Pikachu, #133…" aria-label="Search Pokémon">
        <button class="pixel-btn" type="submit">Open Pokédex</button>
      </form>
      <div class="quick-links">
        <a class="pixel-btn secondary" href="#dex">Browse all Pokémon</a>
        <a class="pixel-btn ghost" href="#hunter">Plan a shiny hunt</a>
        <a class="pixel-btn ghost" href="#training">Find training hordes</a>
      </div>
      ${recentMons.length ? `<div style="margin-top:28px"><strong>Recently viewed</strong><div class="chip-list" style="margin-top:9px">${recentMons.map(p => `<button class="chip" data-open-pokemon="${p.id}">${escapeHtml(p.name)}</button>`).join("")}</div></div>` : ""}
    </div>
    <button type="button" class="hero-console featured-button" id="today-find" aria-label="Open today's Pokémon: ${escapeHtml(featured.name)}">
      <div class="console-screen">
        ${imageTag(featured.id, featured.name, { shiny: settings().shinySprites })}
        <span class="console-label">TODAY'S FIND · #${String(featured.id).padStart(3,"0")} ${escapeHtml(featured.name).toUpperCase()}</span>
      </div>
      <div class="console-dots"><i></i><i></i><i></i></div>
      <small class="today-note">One stable daily pick from the obtainable Pokédex. Changes at your local midnight.</small>
    </button>
  </section>`;
  $("#today-find")?.addEventListener("click", () => go(pokemonPath(featured)));
  $("#home-search").addEventListener("submit", e => {
    e.preventDefault();
    const p = findPokemon(new FormData(e.currentTarget).get("pokemon") || "");
    if (p) go(pokemonPath(p)); else toast("I couldn't find that Pokémon");
  });
  bindCommonClicks();
}

function dexCategoryAvailabilityMatches(pokemon, category, season, time) {
  if (category === "All" && season === "All" && time === "All") return true;
  const availabilityByCategory = pokemon.categoryAvailability || {};
  const categories = category === "All" ? Object.keys(availabilityByCategory) : [category];
  return categories.some(categoryName => (availabilityByCategory[categoryName] || []).some(pair =>
    (season === "All" || pair.season === season || pair.season === "Any") &&
    (time === "All" || pair.time === time)
  ));
}

function filterPokemon() {
  const f = state.dexFilters;
  const q = f.query.trim().toLowerCase();
  return state.pokemon.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !String(p.id).includes(q.replace(/^#/, ""))) return false;
    const categories = p.dexSearchCategories || p.dexCategories || [];
    if (f.category !== "All" && !categories.includes(f.category)) return false;
    if (!dexCategoryAvailabilityMatches(p, f.category, f.season, f.time)) return false;
    if (f.generation !== "All" && generationFor(p.id) !== Number(f.generation)) return false;
    if (f.availability === "Obtainable" && !p.obtainable) return false;
    if (f.availability === "Wild" && !p.hasLocations) return false;
    return true;
  });
}

function renderDex() {
  setActiveNav("dex");
  setPageTitle("Pokédex");
  const categoryGroups = new Map();
  state.dexCategories.forEach(row => {
    const group = row.group || "Encounter categories";
    if (!categoryGroups.has(group)) categoryGroups.set(group, []);
    categoryGroups.get(group).push(row);
  });
  const categoryOptions = [...categoryGroups.entries()].map(([group, rows]) => `<optgroup label="${escapeHtml(group)}">${rows.map(row => `<option value="${escapeHtml(row.id)}" ${row.id===state.dexFilters.category?"selected":""}>${escapeHtml(row.label || row.id)}</option>`).join("")}</optgroup>`).join("");
  const filtered = filterPokemon();
  const visible = filtered.slice(0, state.dexPage * 40);
  $("#app").innerHTML = `<section>
    <div class="section-head"><div><span class="eyebrow">Pocket index</span><h1 class="page-title">Pokédex</h1><p>${filtered.length} Pokémon match your filters.</p></div>
      <button class="pixel-btn secondary" id="dex-shiny">${settings().shinySprites ? "✨ Shiny sprites" : "Normal sprites"}</button>
    </div>
    <div class="toolbar dex-toolbar">
      <div class="field dex-search-field"><label>Search</label><input id="dex-query" value="${escapeHtml(state.dexFilters.query)}" placeholder="Name or number"></div>
      <div class="field"><label>Encounter category</label><select id="dex-category"><option>All</option>${categoryOptions}</select></div>
      <div class="field"><label>Season</label><select id="dex-season">${["All","Spring","Summer","Autumn","Winter"].map(x=>`<option ${x===state.dexFilters.season?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Time</label><select id="dex-time">${["All","Morning","Day","Night"].map(x=>`<option ${x===state.dexFilters.time?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Generation</label><select id="dex-gen"><option>All</option>${[1,2,3,4,5].map(g => `<option value="${g}" ${String(g)===String(state.dexFilters.generation)?"selected":""}>Gen ${g}</option>`).join("")}</select></div>
      <div class="field"><label>Availability</label><select id="dex-availability">${["Obtainable","Wild","All"].map(x=>`<option ${x===state.dexFilters.availability?"selected":""}>${x}</option>`).join("")}</select></div>
      <button class="pixel-btn ghost" id="dex-reset">Reset</button>
    </div>
    ${visible.length ? `<div class="dex-grid">${visible.map(p => pokemonCard(p)).join("")}</div>` : `<div class="empty-state"><h2>No Pokémon found</h2><p>Try clearing one of the filters.</p></div>`}
    ${visible.length < filtered.length ? `<div class="load-more"><button class="pixel-btn secondary" id="load-more">Show more</button></div>` : ""}
  </section>`;
  const update = (restoreQueryFocus = false) => {
    state.dexPage = 1;
    renderDex();
    if (restoreQueryFocus) requestAnimationFrame(() => {
      const input = $("#dex-query");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  };
  $("#dex-query").addEventListener("input", e => { state.dexFilters.query = e.target.value; update(true); });
  $("#dex-category").addEventListener("change", e => { state.dexFilters.category = e.target.value; update(); });
  $("#dex-season").addEventListener("change", e => { state.dexFilters.season = e.target.value; update(); });
  $("#dex-time").addEventListener("change", e => { state.dexFilters.time = e.target.value; update(); });
  $("#dex-gen").addEventListener("change", e => { state.dexFilters.generation = e.target.value; update(); });
  $("#dex-availability").addEventListener("change", e => { state.dexFilters.availability = e.target.value; update(); });
  $("#dex-reset").addEventListener("click", () => { state.dexFilters = { query:"", category:"All", season:"All", time:"All", generation:"All", availability:"Obtainable" }; update(); });
  $("#load-more")?.addEventListener("click", () => { state.dexPage++; renderDex(); });
  $("#dex-shiny").addEventListener("click", () => { const s=settings(); s.shinySprites=!s.shinySprites; saveJSON(STORAGE.settings,s); renderDex(); });
  bindPokemonCards();
}

function statRows(stats) {
  const labels = { hp:"HP", attack:"Attack", defense:"Defense", sp_attack:"Sp. Atk", sp_defense:"Sp. Def", speed:"Speed" };
  return Object.entries(labels).map(([key,label]) => {
    const value = Number(stats[key] || 0); const width = Math.min(100, value / 180 * 100);
    return `<div class="stat-row"><span>${label}</span><strong>${value}</strong><div class="stat-track"><i style="width:${width}%"></i></div></div>`;
  }).join("");
}
function groupedHuntPreview(hunts, limit = 5) {
  const grouped = new Map();
  rankHunts(hunts).filter(h => h.speed > 0).forEach(hunt => {
    const key = `${hunt.location}|${hunt.method}|${Number(hunt.share).toFixed(7)}`;
    if (!grouped.has(key)) grouped.set(key, { ...hunt, availability: [] });
    const row = grouped.get(key);
    hunt.availability.forEach(a => { if (!row.availability.some(x => x.season === a.season && x.time === a.time)) row.availability.push(a); });
  });
  return [...grouped.values()].sort((a,b) => b.targetEph - a.targetEph || a.location.localeCompare(b.location)).slice(0, limit);
}

async function renderPokemon(id) {
  const p = state.pokemonById.get(id);
  if (!p) return renderNotFound();
  setActiveNav("dex");
  setPageTitle(p.name);
  addRecent(id);
  $("#app").innerHTML = `<section class="loading-screen"><div class="pixel-loader"></div><p>Opening ${escapeHtml(p.name)}…</p></section>`;
  const [detail, hunts] = await Promise.all([getDetail(id), getHunts(id)]);
  const s = settings(); const fav = favorites().has(id);
  const line = detail.evolutionLine.map(x => state.pokemonById.get(x)).filter(Boolean);
  const evolutionStages = (detail.evolutionStages || [detail.evolutionLine || [id]])
    .map(stage => stage.map(x => state.pokemonById.get(Number(x))).filter(Boolean))
    .filter(stage => stage.length);
  const ranked = groupedHuntPreview(hunts, 5);
  $("#app").innerHTML = `<section class="pokemon-detail-page ${typeThemeClass(p.types)}">
    <div class="detail-page-tools">
      <a class="back-link" href="#dex">← Back to Pokédex</a>
      <form class="detail-quick-search" id="detail-quick-search">
        <label for="detail-pokemon-query">Jump to Pokémon</label>
        <div>
          <input id="detail-pokemon-query" name="pokemon" list="pokemon-list" autocomplete="off" placeholder="Name or Pokédex number">
          <button class="pixel-btn small" type="submit">Open</button>
        </div>
      </form>
    </div>
    <div class="detail-hero">
      <div class="detail-sprite-card ${typeThemeClass(p.types)}">
        <button class="pixel-btn small shiny-toggle ${s.shinySprites?"active":""}" id="detail-shiny">${s.shinySprites?"✨ Shiny":"☆ Normal"}</button>
        ${imageTag(id, p.name, { shiny:s.shinySprites })}
      </div>
      <div class="detail-main panel">
        <span class="detail-number">#${String(id).padStart(3,"0")}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="type-row">${typeBadges(p.types)}</div>
        <div class="detail-actions">
          <a class="pixel-btn" href="${hunterHref(p)}">Find the best shiny hunt</a>
          <button class="pixel-btn secondary" id="detail-favorite">${fav?"★ Favorited":"☆ Add favorite"}</button>
        </div>
        <div class="fact-grid">
          <div class="fact"><span>Height</span><strong>${detail.heightM} m</strong></div>
          <div class="fact"><span>Weight</span><strong>${detail.weightKg} kg</strong></div>
          <div class="fact"><span>Catch rate</span><strong>${detail.catchRate ?? "—"}</strong></div>
          <div class="fact"><span>Growth</span><strong>${escapeHtml(detail.expType || "—")}</strong></div>
        </div>
        <div class="detail-method-summary">
          <div><span>Wild encounter methods</span><small>${orderedMethods(p.methods || []).length ? "Available methods in the current Pokédex dump." : "No wild encounter method is listed."}</small></div>
          <div class="method-chip-list">${orderedMethods(p.methods || []).length ? orderedMethods(p.methods || []).map(method => `<span class="method-chip">${escapeHtml(method)}</span>`).join("") : '<span class="method-chip muted">Not obtainable in the wild</span>'}</div>
        </div>
        ${(p.wildSafetyRisks || []).length ? `<div class="detail-risk-summary">${safetyWarning(p.wildSafetyRisks)}<div><strong>Wild encounter safety warnings</strong><small>${escapeHtml(safetyRiskText(p.wildSafetyRisks))} Warnings are based on the four level-up moves available at the encounter level and known held-item risks.</small></div></div>` : ""}
      </div>
    </div>
    <div class="detail-layout">
      <div>
        <article class="detail-card"><h2>Base stats</h2><div class="stat-list">${statRows(detail.stats)}</div></article>
        <article class="detail-card"><h2>Evolution family</h2><div class="evo-family-stages">${evolutionStages.map((stage,stageIndex)=>`${stageIndex?'<span class="evo-stage-arrow" aria-hidden="true">→</span>':''}<div class="evo-stage">${stage.map(mon=>`<button class="evo-mon" data-open-pokemon="${mon.id}">${imageTag(mon.id,mon.name,{icon:true})}<span>${escapeHtml(mon.name)}</span></button>`).join("")}</div>`).join("")}</div></article>
        <article class="detail-card"><h2>Moves</h2>${Object.entries(detail.moves).sort(([a],[b])=>a.localeCompare(b)).map(([kind,moves])=>`<details class="move-group"><summary>${escapeHtml(kind)} · ${moves.length}</summary><div class="move-list">${moves.map(m=>`<div class="move"><span>${escapeHtml(m.name)}</span>${m.level!=null?`<small>Lv. ${m.level}</small>`:""}</div>`).join("")}</div></details>`).join("") || '<p>No move data.</p>'}</article>
      </div>
      <aside>
        <article class="detail-card"><h2>Abilities</h2><div class="chip-list">${detail.abilities.map(a=>`<span class="chip ${a.hidden ? "hidden-ability-chip" : ""}">${escapeHtml(a.name)}${a.hidden ? " · Hidden" : ""}</span>`).join("") || '<span class="chip">—</span>'}</div></article>
        <article class="detail-card"><h2>Breeding</h2><div class="chip-list">${detail.eggGroups.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join("") || '<span class="chip">Cannot breed</span>'}</div></article>
        <article class="detail-card"><h2>Wild held items</h2>${detail.heldItems.length ? `<div class="item-grid">${detail.heldItems.map(item=>`<div class="item-entry">${itemImageTag(item)}<span>${escapeHtml(item.name)}</span></div>`).join("")}</div>` : '<p class="muted-empty">None listed.</p>'}</article>
        <article class="detail-card hunt-preview-card"><div class="card-title-row"><h2>Best hunt preview</h2><a class="text-link" href="${hunterHref(p)}">Compare all →</a></div>${ranked.length ? `<div class="hunt-preview-list">${ranked.map((h,i)=>`<a class="hunt-preview-row" href="${hunterHref(p)}"><span class="hunt-preview-rank">${i+1}</span><span><strong>${escapeHtml(h.location)}</strong><small>${escapeHtml(h.method)} · ${formatPercent(h.share)} target share</small><span class="hunt-preview-availability">${availabilityVisual(h.availability)}</span></span><b>${formatRate(h.targetEph)}/hr</b></a>`).join("")}</div>` : '<p>No wild encounter listed.</p>'}</article>
      </aside>
    </div>
  </section>`;
  $("#detail-quick-search").addEventListener("submit", event => {
    event.preventDefault();
    const next = findPokemon(new FormData(event.currentTarget).get("pokemon"));
    if (next) go(pokemonPath(next));
    else toast("I couldn't find that Pokémon");
  });
  $("#detail-shiny").addEventListener("click", () => { const x=settings(); x.shinySprites=!x.shinySprites; saveJSON(STORAGE.settings,x); renderPokemon(id); });
  $("#detail-favorite").addEventListener("click", () => toggleFavorite(id));
  bindCommonClicks();
}

function optionAvailable(opt, season, time) {
  return opt.availability.some(a => (season === "All" || a.season === season || a.season === "Any") && (time === "All" || a.time === time));
}
function rankHunts(hunts) {
  const s = settings();
  const denominator = effectiveShinyDenominator(s);
  return hunts.map(h => {
    const speed = Number(s.speeds[h.method] || 0);
    const members = h.targetMembers?.length
      ? h.targetMembers
      : [{ pokemonId: null, name: "Target", share: Number(h.share || 0), safariCapture: h.safariCapture || null }];
    const targetShare = members.reduce((sum, member) => sum + Number(member.share || 0), 0);
    const targetEph = speed * targetShare;
    let rankingEph = 0;
    let adjustedMemberCount = 0;
    members.forEach(member => {
      const memberEph = speed * Number(member.share || 0);
      const catchChance = Number(member.safariCapture?.ballsOnlySuccess || 0);
      if (h.safari && s.adjustSafariCatch && catchChance > 0) {
        rankingEph += memberEph * catchChance;
        adjustedMemberCount += 1;
      } else {
        rankingEph += memberEph;
      }
    });
    const safariAdjusted = adjustedMemberCount > 0;
    const displaySafariSuccess = safariAdjusted && targetEph > 0 ? rankingEph / targetEph : 0;
    return {
      ...h, share: targetShare, speed, targetEph, rankingEph, safariAdjusted, displaySafariSuccess,
      hoursPerShiny: rankingEph > 0 ? denominator / rankingEph : Infinity,
    };
  }).sort((a,b) => b.rankingEph - a.rankingEph || b.targetEph - a.targetEph || b.share - a.share || a.location.localeCompare(b.location));
}
function availabilityLabel(items) {
  const seasons = ["Spring","Summer","Autumn","Winter"];
  const times = ["Morning","Day","Night"];
  const map = new Map();
  items.forEach(({season,time}) => { if(!map.has(season)) map.set(season,new Set()); map.get(season).add(time); });
  const allSeasonSets = seasons.map(s => map.get(s));
  if (seasons.every(s => map.has(s)) && allSeasonSets.every(set => times.every(t => set.has(t)))) return "Any season · Any time";
  const signatures = seasons.filter(s=>map.has(s)).map(s=>[s,[...map.get(s)].sort().join("|")]);
  if (signatures.length === 4 && signatures.every(([,sig])=>sig===signatures[0][1])) {
    const set=map.get(seasons[0]); return `Any season · ${times.every(t=>set.has(t))?"Any time":[...set].join(" / ")}`;
  }
  return [...map.entries()].map(([season,set]) => `${season}: ${times.every(t=>set.has(t))?"Any time":[...set].join(" / ")}`).join(" · ");
}
function availabilityVisual(items) {
  const seasons = [...new Set(items.map(x => x.season))];
  const times = [...new Set(items.map(x => x.time))];
  const seasonHtml = seasons.length >= 4 || seasons.includes("Any")
    ? `<span class="availability-pill"><span class="all-symbol">✦</span> Any season</span>`
    : seasons.map(x => `<span class="availability-pill">${filterIcon("season", x)} ${escapeHtml(x)}</span>`).join("");
  const timeHtml = times.length >= 3
    ? `<span class="availability-pill"><span class="all-symbol">◷</span> Any time</span>`
    : times.map(x => `<span class="availability-pill">${filterIcon("time", x)} ${escapeHtml(x)}</span>`).join("");
  return `<span class="availability-icons">${seasonHtml}${timeHtml}</span>`;
}

function huntPhasePreview(hunt, targetIds = [], { prominent = false } = {}) {
  const componentsSource = state.phasePreviews?.[String(hunt.tableId)] || state.encounterTables?.[String(hunt.tableId)]?.components || [];
  if (!componentsSource.length) return "";
  const targets = new Set((targetIds || []).map(Number));
  const components = [...componentsSource].sort((a, b) => {
    const aTarget = targets.has(Number(a.pokemonId)) ? 1 : 0;
    const bTarget = targets.has(Number(b.pokemonId)) ? 1 : 0;
    return bTarget - aTarget || Number(b.share || 0) - Number(a.share || 0) || Number(a.pokemonId) - Number(b.pokemonId);
  });
  const shiny = settings().shinySprites;
  const allTargets = components.length > 0 && components.every(component => targets.has(Number(component.pokemonId)));
  const targetComponents = components.filter(component => targets.has(Number(component.pokemonId)));
  const isHorde = /horde/i.test(String(hunt.method || ""));
  const poolLabel = allTargets
    ? isHorde ? "100% target horde" : "100% target encounter pool"
    : "Encounter pool";
  const targetSummary = targetComponents.map(component => component.name).join(" · ");
  const phaseLink = component => {
    const isTarget = targets.has(Number(component.pokemonId));
    const title = `${component.name}${isTarget ? " · target" : ""} · ${formatPercent(component.share)} of Pokémon shown`;
    const risks = safetyWarningsEnabled(hunt) ? (component.safetyRisks || []) : [];
    const riskText = risks.length ? ` · safety: ${safetyRiskText(risks)}` : "";
    const fullTitle = title + riskText;
    return `<a class="phase-preview-mon ${isTarget ? "target" : ""} ${risks.length ? "has-wild-risk" : ""}" href="${pokemonHref(component.pokemonId)}" title="${escapeHtml(fullTitle)}" aria-label="${escapeHtml(fullTitle)}">${isTarget ? `<b class="phase-target-badge">Target</b>` : ""}${risks.length ? safetyWarning(risks,{compact:true}) : ""}${imageTag(component.pokemonId, component.name, { shiny, icon:true })}<span>${escapeHtml(component.name)}</span></a>`;
  };
  if (allTargets) {
    return `<div class="hunt-phase-preview pure-target ${prominent ? "prominent" : ""}">
      <div class="phase-preview-head"><span class="phase-preview-title">Encounter pool</span><button class="phase-preview-open" type="button" data-open-hunt="${escapeHtml(hunt.uiKey)}">Full split →</button></div>
      <div class="phase-preview-pure"><span class="phase-preview-check" aria-hidden="true">✓</span><div class="phase-preview-pure-copy"><strong>${poolLabel}</strong><small>${escapeHtml(targetSummary || "Only target Pokémon appear in this table")}</small></div><div class="phase-preview-pure-mons">${components.map(phaseLink).join("")}</div></div>
    </div>`;
  }
  const maxVisible = prominent ? 14 : 12;
  const visible = components.slice(0, maxVisible);
  const hidden = components.length - visible.length;
  return `<div class="hunt-phase-preview ${prominent ? "prominent" : ""}">
    <div class="phase-preview-head"><span class="phase-preview-title">Encounter pool</span><button class="phase-preview-open" type="button" data-open-hunt="${escapeHtml(hunt.uiKey)}">Full split →</button></div>
    <div class="phase-preview-icons">${visible.map(phaseLink).join("")}${hidden > 0 ? `<button class="phase-preview-more" type="button" data-open-hunt="${escapeHtml(hunt.uiKey)}" title="Open the full encounter split"><strong>+${hidden}</strong><span>more</span></button>` : ""}</div>
  </div>`;
}

function hunterCard(h, rank, lineMode = false, targetIds = []) {
  const safariLine = h.safari
    ? h.displaySafariSuccess > 0
      ? `<br><span class="safari-inline">${formatPercent(h.displaySafariSuccess)} weighted balls-only catch estimate${h.safariAdjusted ? " · applied" : ""}</span>`
      : `<br><span class="safari-inline muted-inline">Safari catch estimate unavailable</span>`
    : "";
  const shareLabel = lineMode ? "evolution-line" : "target";
  const shinyLabel = lineMode ? "any line" : "target";
  return `<article class="hunter-card">
    <div class="hunter-rank">${rank}</div>
    <div><button class="hunt-location-button" type="button" data-open-hunt="${escapeHtml(h.uiKey)}"><span>${escapeHtml(h.location)}</span><small>View full encounter split ↓</small></button><div class="hunt-meta"><span>${escapeHtml(h.region)}</span><span>${escapeHtml(h.encounterType)}</span><span>Lv. ${h.minLevel || "?"}–${h.maxLevel || "?"}</span><span class="availability-wrap" title="${escapeHtml(availabilityLabel(h.availability))}">${availabilityVisual(h.availability)}</span></div><div style="margin-top:7px">${encounterQualityBadge(h)}</div>${huntPhasePreview(h, targetIds)}${targetMemberBreakdown(h, h.speed, { compact:true })}</div>
    <div class="hunt-score"><strong>${formatRate(h.targetEph)}/hr</strong><small>${formatPercent(h.share)} ${shareLabel} share<br>${hoursLabel(h.hoursPerShiny)} per ${h.safariAdjusted ? "caught " : ""}${shinyLabel} shiny${safariLine}</small></div>
  </article>`;
}

function encounterDialog() {
  let dialog = $("#encounter-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "encounter-dialog";
  dialog.className = "encounter-dialog";
  dialog.innerHTML = `<div class="encounter-dialog-shell"><button class="dialog-close" type="button" aria-label="Close encounter split">×</button><div class="encounter-dialog-content"></div></div>`;
  document.body.append(dialog);
  $(".dialog-close", dialog).addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  return dialog;
}

async function openEncounterSplit(h, targetIds = []) {
  const dialog = encounterDialog();
  const content = $(".encounter-dialog-content", dialog);
  content.innerHTML = `<div class="loading-screen compact-loading"><div class="pixel-loader"></div><p>Loading encounter split…</p></div>`;
  if (!dialog.open) dialog.showModal();
  const tables = await getEncounterTables();
  const table = tables[String(h.tableId)];
  if (!table) {
    content.innerHTML = `<div class="empty-state"><h2>Encounter split unavailable</h2><p>This generated table could not be found.</p></div>`;
    return;
  }
  const speed = Number(settings().speeds[table.method] || 0);
  const targetIdSet = new Set((Array.isArray(targetIds) ? targetIds : targetIds ? [targetIds] : []).map(Number));
  const rows = table.components.map(component => {
    const isTarget = targetIdSet.has(Number(component.pokemonId));
    const speciesEph = speed * Number(component.share || 0);
    const slow = table.slowdownWarningsApplicable === false ? [] : (component.slowAbilities || []);
    const risks = safetyWarningsEnabled(table) ? (component.safetyRisks || []) : [];
    const slowMarker = slow.length ? `<span class="slowdown-marker" title="May add a start-of-battle ability animation/message: ${escapeHtml(slow.join(", "))}"><img src="assets/icons/encounter-slowdown.png" alt="Start-of-battle slowdown warning"><span>${escapeHtml(slow.join(" / "))}</span></span>` : "";
    const riskMarker = risks.length ? safetyWarning(risks,{compact:true}) : "";
    const safetyRows = safetyRiskRows(risks);
    const safari = component.safariCapture;
    const safariHtml = safari ? `<div class="split-safari"><strong>${formatPercent(safari.ballsOnlySuccess)}</strong> balls-only catch estimate<br><small>${formatPercent(safari.fleePerTurn)} flee chance after a failed ball · ${escapeHtml(safari.scope)}</small></div>` : table.safari ? `<div class="split-safari unknown"><strong>Unknown catch estimate</strong><br><small>No matched community flee-rate entry for this region.</small></div>` : "";
    const sources = component.sources || [];
    const encounterRollChance = sources.reduce((sum, source) => sum + Number(source.eventRate || 0), 0);
    const methodRollChance = table.method.includes("Horde") && Number(table.rawTableTotal || 0) > 0
      ? encounterRollChance / Number(table.rawTableTotal)
      : encounterRollChance;
    const sourceHtml = sources.length ? `<div class="split-source-tags">${sources.map(source => {
      const count = Number(source.count || 1);
      const countText = count > 1 ? ` × ${count} Pokémon shown` : "";
      const rawRate = Number(source.eventRate || 0);
      if (source.kind === "sweet-scent" && Number(table.rawTableTotal || 0) > 0) {
        const normalizedRate = rawRate / Number(table.rawTableTotal);
        return `<span class="split-source-tag sweet-scent">${escapeHtml(source.label || "Sweet Scent")} · ${formatPercent(normalizedRate, 1)} of Sweet Scent rolls <small>(raw Dex block ${formatPercent(rawRate, 1)})</small>${countText}</span>`;
      }
      return `<span class="split-source-tag ${escapeHtml(source.kind || "single")}">${escapeHtml(source.label || "Encounter")} · ${formatPercent(rawRate, 1)} of encounter rolls${countText}</span>`;
    }).join("")}</div>` : "";
    const rollLabel = table.method.includes("Horde") ? "of Sweet Scent rolls" : "of encounter rolls";
    return `<article class="split-species ${isTarget ? "target-species" : ""}">
      <div class="split-sprite">${imageTag(component.pokemonId, component.name, {icon:true})}${slowMarker}${riskMarker}</div>
      <div class="split-species-main"><div class="split-species-title"><a href="${pokemonHref(component.pokemonId)}">${escapeHtml(component.name)}</a>${isTarget ? `<span class="target-label">${targetIdSet.size > 1 ? "Target line" : "Target"}</span>` : ""}</div>
        <div class="split-metrics">
          <span><strong>${formatPercent(methodRollChance, 1)}</strong> ${rollLabel} contain ${escapeHtml(component.name)}</span>
          <span><strong>${formatPercent(component.share, 1)}</strong> of all Pokémon shown</span>
          <span><strong>${formatRate(speciesEph)}/hr</strong> at the current method speed</span>
          <span>Lv. ${component.minLevel || "?"}–${component.maxLevel || "?"}</span>
        </div>${sourceHtml}${safetyRows}${safariHtml}</div>
    </article>`;
  }).join("");
  const safariNote = table.safari ? `<div class="split-source"><strong>Safari estimates:</strong> Balls-only calculations are applied to matched Johto Safari and Sinnoh Great Marsh species. Kanto and Hoenn remain encounter-share estimates without catch-rate adjustment.</div>` : "";
  const safariCoverageNote = table.safariPool?.note ? `<p><strong>Safari source coverage:</strong> ${escapeHtml(table.safariPool.note)}${table.safariPool.lureModel ? " The Lure model is applied only to the documented base pool." : ""}</p>` : "";
  const affectedSlowdowns = table.slowdownWarningsApplicable === false ? [] : table.components.filter(component => (component.slowAbilities || []).length);
  const slowdownLegend = affectedSlowdowns.length ? `<div class="slowdown-legend"><img src="assets/icons/encounter-slowdown.png" alt=""><span><strong>${affectedSlowdowns.length} ${affectedSlowdowns.length === 1 ? "species has" : "species have"} a possible start-of-battle delay.</strong> The red arrow is shown only on affected Pokémon; hover it to see the relevant ${affectedSlowdowns.length === 1 ? "ability" : "abilities"}.</span></div>` : "";
  const affectedRisks = safetyWarningsEnabled(table) ? table.components.filter(component => (component.safetyRisks || []).length) : [];
  const riskLegend = affectedRisks.length ? `<div class="wild-risk-legend"><span aria-hidden="true">⚠</span><span><strong>${affectedRisks.length} ${affectedRisks.length === 1 ? "species has" : "species have"} an encounter safety warning at these levels.</strong> Detailed risks and recommended preparation are shown on each affected species below.</span></div>` : "";
  const isSweetScent = table.method.includes("Horde");
  const rawLabel = isSweetScent ? "Raw Dex horde block" : "Encounter outcome table";
  const shownSummary = table.containsRandomHordes ? `<span>Avg. ${formatNumber(Number(table.shownTableTotal || 1), 2)} Pokémon shown / encounter roll</span>` : "";
  const explanation = isSweetScent
    ? "Sweet Scent takes the extracted horde block and normalizes it to a 100% method table. Raw Dex percentages are shown only as the source block."
    : table.method.startsWith("Lure")
      ? "The no-Lure encounter table totals 100%, including natural hordes. In this 5% Lure model, every existing outcome is multiplied by 95%, then the Lure-exclusive outcome is inserted at 5%. Pokémon-shown shares weight 3×/5× hordes by their size."
      : "Encounter outcomes total 100%, including natural hordes. Pokémon-shown shares are a second view used for shiny efficiency and weight 3×/5× hordes by their size.";
  const calculationNotes = `<details class="calculation-notes"><summary>Calculation notes</summary><div><p>${escapeHtml(explanation)}</p><p>${escapeHtml(table.note)}</p>${safariCoverageNote}${safariNote}</div></details>`;
  const pool = table.safariPool;
  const splitSummaryMain = pool?.status === "partial"
    ? `<span>${escapeHtml(pool.label || "Base pool")}: ${formatPercent(Number(pool.documentedTotal || 0), 0)} documented</span>${pool.lureModel ? '<span>Lure model uses documented base</span>' : ''}<span>Source-limited static table</span>`
    : `<span>${rawLabel}: ${formatPercent(table.rawTableTotal, table.rawTableTotal < .1 ? 1 : 0)}</span>${isSweetScent ? '<span>Sweet Scent table: 100%</span>' : ''}${shownSummary}<span>${escapeHtml(table.confidence)} confidence</span>`;
  content.innerHTML = `<div class="split-head"><div><span class="eyebrow">Full encounter split</span><h2>${escapeHtml(table.location)}</h2><p><strong>${escapeHtml(table.method)}</strong> · ${escapeHtml(table.region)} · ${escapeHtml(table.encounterType)}</p></div><div class="split-speed"><strong>${formatNumber(speed,0)}/hr</strong><small>Pokémon shown</small></div></div>
    <div class="availability-feature">${availabilityVisual(h.availability)}</div>
    <div class="split-summary">${splitSummaryMain}<span>${table.components.length} species</span></div>
    ${slowdownLegend}${riskLegend}
    <div class="split-list">${rows}</div>
    ${calculationNotes}`;
  $$('a[href^="#pokemon/"]', content).forEach(link => link.addEventListener('click', () => dialog.close()));
}

function bindEncounterSplitButtons(targetIds) {
  $$('[data-open-hunt]').forEach(button => button.addEventListener('click', () => {
    const hunt = state.activeHuntMap.get(button.dataset.openHunt);
    if (hunt) openEncounterSplit(hunt, targetIds).catch(error => { console.error(error); toast("Could not load the encounter split"); });
  }));
}

async function renderHunter(id = null) {
  setActiveNav("hunter");
  const s = settings();
  const targetMode = normalizedTargetMode(s.hunterTargetMode);
  if (id) {
    const requestedId = id;
    id = normalizedHunterSelection(id, targetMode);
    state.hunterSelectedId = id;
    if (id && requestedId !== id) history.replaceState(null, "", `#${hunterPath(id)}`);
  } else if (state.hunterSelectedId) {
    state.hunterSelectedId = normalizedHunterSelection(state.hunterSelectedId, targetMode);
  }
  if (s.lockSeason && s.currentSeason !== "All") state.hunterFilters.season = s.currentSeason;
  if (s.lockTime && s.currentTime !== "All") state.hunterFilters.time = s.currentTime;

  const saveTargetMode = mode => {
    const next = settings();
    next.settingsVersion = 6;
    next.hunterTargetMode = normalizedTargetMode(mode);
    saveJSON(STORAGE.settings, next);
  };

  if (!id) {
    setPageTitle("Shiny Hunter");
    const favMons = [...favorites()].map(x => state.pokemonById.get(x)).filter(Boolean);
    const selected = state.pokemonById.get(Number(state.hunterSelectedId)) || null;
    $("#app").innerHTML = `<section>
      <div class="section-head"><div><span class="eyebrow">Route planner</span><h1 class="page-title">Shiny Hunter</h1><p>Choose a Pokémon, then compare exact routes or its complete evolution line.</p></div></div>
      <div class="panel hunter-start-panel">
        ${hunterPickerMarkup(selected, targetMode)}
        <div class="hunter-scope-row">
          <div><strong>What counts as the target?</strong><small>Use one exact form, or combine every wild form in its evolution line.</small></div>
          ${targetModeControl(targetMode, "Shiny Hunter target scope")}
        </div>
        <div class="availability-fix-grid">
          <div class="season-fix-card">
            <div><strong>Hunting season</strong><small>Choose your current in-game season.</small></div>
            ${iconChoiceGroup("season", ["All","Spring","Summer","Autumn","Winter"], state.hunterFilters.season, "Hunting season")}
            <label class="toggle-line"><input id="hunter-lock-season" type="checkbox" ${s.lockSeason ? "checked" : ""}><span>Keep this season fixed</span></label>
          </div>
          <div class="season-fix-card time-fix-card">
            <div><strong>Time of day</strong><small>Limit results to morning, day or night.</small></div>
            ${iconChoiceGroup("time", ["All","Morning","Day","Night"], state.hunterFilters.time, "Hunting time")}
            <label class="toggle-line"><input id="hunter-lock-time" type="checkbox" ${s.lockTime ? "checked" : ""}><span>Keep this time fixed</span></label>
          </div>
        </div>
        <div class="favorites-in-hunter">
          <div class="mini-section-head"><div><strong>Your favorite hunts</strong><small>Star Pokémon in the Pokédex to keep them here.</small></div>${favMons.length ? `<span>${favMons.length} saved</span>` : ""}</div>
          ${favMons.length ? `<div class="dex-grid favorites-grid">${favMons.map(p=>pokemonCard(p,{target:"hunter"})).join("")}</div>` : `<div class="empty-inline"><span>☆</span><p>No favorites saved yet.</p><a href="#dex">Browse the Pokédex</a></div>`}
        </div>
      </div>
    </section>`;
    bindHunterPicker(targetMode);
    $$('[data-target-mode]').forEach(btn => btn.addEventListener('click', () => {
      const mode = normalizedTargetMode(btn.dataset.targetMode);
      saveTargetMode(mode);
      if (state.hunterSelectedId) state.hunterSelectedId = normalizedHunterSelection(state.hunterSelectedId, mode);
      renderHunter();
    }));
    $$('[data-season-choice]').forEach(btn => btn.addEventListener('click', () => {
      state.hunterFilters.season = btn.dataset.seasonChoice;
      const next = settings();
      if ($("#hunter-lock-season")?.checked) { next.lockSeason = true; next.currentSeason = state.hunterFilters.season; saveJSON(STORAGE.settings, next); }
      renderHunter();
    }));
    $$('[data-time-choice]').forEach(btn => btn.addEventListener('click', () => {
      state.hunterFilters.time = btn.dataset.timeChoice;
      const next = settings();
      if ($("#hunter-lock-time")?.checked) { next.lockTime = true; next.currentTime = state.hunterFilters.time; saveJSON(STORAGE.settings, next); }
      renderHunter();
    }));
    $("#hunter-lock-season").addEventListener("change", e => {
      const next = settings(); next.lockSeason = e.target.checked; next.currentSeason = state.hunterFilters.season; saveJSON(STORAGE.settings, next); renderHunter();
    });
    $("#hunter-lock-time").addEventListener("change", e => {
      const next = settings(); next.lockTime = e.target.checked; next.currentTime = state.hunterFilters.time; saveJSON(STORAGE.settings, next); renderHunter();
    });
    bindPokemonCards();
    return;
  }

  const p = state.pokemonById.get(id);
  if (!p) return renderNotFound();
  setPageTitle(`${p.name} Shiny Hunt`);
  $("#app").innerHTML = `<section class="loading-screen"><div class="pixel-loader"></div><p>Checking every route for ${escapeHtml(p.name)}…</p></section>`;
  const [targetData] = await Promise.all([loadHunterTarget(id, targetMode), getPhasePreviews()]);
  const hunts = targetData.hunts;
  const targetPokemon = targetData.targetPokemon;
  const targetIds = targetData.targetIds;
  const lineMode = targetMode === "line" && targetPokemon.length > 1;
  const lineRoot = targetPokemon[0] || p;
  const targetTitle = lineMode ? `${lineRoot.name} line` : p.name;
  const expectedShinyLabel = lineMode ? "any line" : "target";
  const regions = [...new Set(hunts.map(h=>h.region))].sort();
  const rankedAll = rankHunts(hunts);
  const f = state.hunterFilters;
  const filtered = rankedAll.filter(h =>
    h.speed > 0 &&
    (f.method === "All" || h.method === f.method) &&
    (f.region === "All" || h.region === f.region) &&
    (f.confidence === "All" || h.confidence === f.confidence) &&
    optionAvailable(h, f.season, f.time)
  );
  state.activeHuntMap = new Map();
  filtered.forEach((hunt, index) => {
    hunt.uiKey = String(index);
    state.activeHuntMap.set(hunt.uiKey, hunt);
  });
  const best = filtered[0];
  const byMethod = new Map();
  filtered.forEach(h => { if (!byMethod.has(h.method)) byMethod.set(h.method, []); byMethod.get(h.method).push(h); });
  const methodOrder = state.methods.map(m=>m.id).filter(m=>byMethod.has(m));
  const currentSettings = settings();
  const effectiveDenominator = effectiveShinyDenominator(currentSettings);
  const bannerSprites = lineMode
    ? `<div class="hunter-family-sprites">${targetPokemon.map(mon => imageTag(mon.id, mon.name, { shiny:true, icon:true, className:"hunter-family-sprite" })).join("")}</div>`
    : imageTag(id,p.name,{shiny:true});
  const familyNames = lineMode ? `<p class="hunter-family-names">${targetPokemon.map(mon => escapeHtml(mon.name)).join(" · ")}</p>` : "";
  $("#app").innerHTML = `<section class="hunter-shell">
    <a class="back-link" href="#hunter">← Choose another Pokémon</a>
    <div class="hunter-banner">${bannerSprites}<div><span class="eyebrow">${lineMode ? "Evolution-line planner" : "Shiny route planner"}</span><h1>${escapeHtml(targetTitle)}</h1>${familyNames}</div><a class="pixel-btn secondary" href="${pokemonHref(id)}">Open Pokédex entry</a></div>
    <div class="toolbar hunter-filters">
      <div class="field target-scope-field"><label>Target scope</label>${targetModeControl(targetMode, "Target scope")}</div>
      <div class="field"><label>Method</label><select id="hunt-method"><option>All</option>${state.methods.filter(m=>Number(currentSettings.speeds[m.id]||0)>0).map(m=>`<option ${m.id===f.method?"selected":""}>${m.id}</option>`).join("")}</select></div>
      <div class="field"><label>Region</label><select id="hunt-region"><option>All</option>${regions.map(x=>`<option ${x===f.region?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Confidence</label><select id="hunt-confidence">${["All","High","Medium","Low"].map(x=>`<option ${x===f.confidence?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field filter-button-field"><label>Season ${currentSettings.lockSeason ? "· locked" : ""}</label>${iconChoiceGroup("season", ["All","Spring","Summer","Autumn","Winter"], f.season, "Season filter")}</div>
      <div class="field filter-button-field"><label>Time ${currentSettings.lockTime ? "· locked" : ""}</label>${iconChoiceGroup("time", ["All","Morning","Day","Night"], f.time, "Time filter")}</div>
      <div class="filter-locks">
        <label class="toggle-line compact"><input id="hunter-lock-season" type="checkbox" ${currentSettings.lockSeason ? "checked" : ""}><span>Keep season fixed</span></label>
        <label class="toggle-line compact"><input id="hunter-lock-time" type="checkbox" ${currentSettings.lockTime ? "checked" : ""}><span>Keep time fixed</span></label>
      </div>
    </div>
    ${best ? `<article class="best-hunt"><div><span class="eyebrow">Best matching option</span><button type="button" class="best-location-button" data-open-hunt="${escapeHtml(best.uiKey)}"><span>${escapeHtml(best.location)}</span><small>Open the full ${escapeHtml(best.method)} split ↓</small></button><p><strong>${escapeHtml(best.method)}</strong> · ${escapeHtml(best.region)}</p><div class="availability-feature">${availabilityVisual(best.availability)}</div><div class="chip-list"><span class="chip">${escapeHtml(best.encounterType)}</span><span class="chip">Lv. ${best.minLevel||"?"}–${best.maxLevel||"?"}</span>${encounterQualityBadge(best,{chip:true})}</div>${huntPhasePreview(best, targetIds, { prominent:true })}${targetMemberBreakdown(best, best.speed)}</div><div><div class="big-number">${formatRate(best.targetEph)}<small>${escapeHtml(targetTitle)} encounters/hour</small></div><div class="metric-grid"><div class="metric"><span>${lineMode ? "Evolution-line share" : "Target share"}</span><strong>${formatPercent(best.share)}</strong></div><div class="metric"><span>Method speed</span><strong>${formatNumber(best.speed,0)}/hr</strong></div><div class="metric"><span>Expected ${best.safariAdjusted ? "caught " : ""}${expectedShinyLabel} shiny</span><strong>${hoursLabel(best.hoursPerShiny)}</strong></div><div class="metric"><span>${best.displaySafariSuccess > 0 ? "Weighted catch estimate" : "Current shiny rate"}</span><strong>${best.displaySafariSuccess > 0 ? formatPercent(best.displaySafariSuccess) : `≈ 1 / ${Math.round(effectiveDenominator).toLocaleString()}`}</strong></div></div></div></article>` : `<div class="empty-state"><h2>No matching hunt found</h2><p>Try clearing a season, time or method filter.</p></div>`}
    ${best ? methodOrder.map(method => `<section class="method-section"><h2 class="method-title">${escapeHtml(method)}</h2><div class="hunt-list">${byMethod.get(method).slice(0,8).map((h,i)=>hunterCard(h,i+1,lineMode,targetIds)).join("")}</div></section>`).join("") : ""}
  </section>`;
  const rerender = () => renderHunter(id);
  $$('[data-target-mode]').forEach(btn => btn.addEventListener('click', () => {
    const mode = normalizedTargetMode(btn.dataset.targetMode);
    saveTargetMode(mode);
    const nextId = normalizedHunterSelection(id, mode);
    state.hunterSelectedId = nextId;
    if (nextId !== id) go(hunterPath(nextId)); else rerender();
  }));
  [["#hunt-method","method"],["#hunt-region","region"],["#hunt-confidence","confidence"]].forEach(([sel,key]) => $(sel).addEventListener("change",e=>{state.hunterFilters[key]=e.target.value;rerender();}));
  $$('[data-season-choice]').forEach(btn => btn.addEventListener('click', () => {
    state.hunterFilters.season = btn.dataset.seasonChoice;
    const next = settings();
    if ($("#hunter-lock-season")?.checked) { next.lockSeason = true; next.currentSeason = state.hunterFilters.season; saveJSON(STORAGE.settings, next); }
    rerender();
  }));
  $$('[data-time-choice]').forEach(btn => btn.addEventListener('click', () => {
    state.hunterFilters.time = btn.dataset.timeChoice;
    const next = settings();
    if ($("#hunter-lock-time")?.checked) { next.lockTime = true; next.currentTime = state.hunterFilters.time; saveJSON(STORAGE.settings, next); }
    rerender();
  }));
  $("#hunter-lock-season").addEventListener("change", e => {
    const next = settings(); next.lockSeason = e.target.checked; next.currentSeason = state.hunterFilters.season; saveJSON(STORAGE.settings, next); rerender();
  });
  $("#hunter-lock-time").addEventListener("change", e => {
    const next = settings(); next.lockTime = e.target.checked; next.currentTime = state.hunterFilters.time; saveJSON(STORAGE.settings, next); rerender();
  });
  bindEncounterSplitButtons(targetIds);
}

function renderFavorites() {
  go("hunter");
}


function routeLocationKey(row) { return `${row.region}::${row.location}`; }
function routeOption(row) {
  return {
    ...row,
    uiKey: `route-${row.tableId}`,
    minLevel: 0,
    maxLevel: 0,
  };
}
function routeSpeciesPreview(table) {
  if (!table?.components?.length) return "";
  const components = table.components.slice(0, 4);
  const risksApplicable = safetyWarningsEnabled(table);
  return `<div class="route-species-preview">${components.map(component => { const risks=risksApplicable ? (component.safetyRisks||[]) : []; const title=`${component.name} · ${formatPercent(component.share)}${risks.length ? ` · safety: ${safetyRiskText(risks)}` : ""}`; return `<span class="${risks.length ? "has-wild-risk" : ""}" title="${escapeHtml(title)}">${risks.length ? safetyWarning(risks,{compact:true}) : ""}${imageTag(component.pokemonId, component.name, { icon:true })}<small>${escapeHtml(component.name)}</small></span>`; }).join("")}${table.components.length > components.length ? `<b>+${table.components.length - components.length}</b>` : ""}</div>`;
}

async function renderRouteSearcher() {
  setActiveNav("routes");
  setPageTitle("Route Searcher");
  $("#app").innerHTML = `<section class="loading-screen"><div class="pixel-loader"></div><p>Opening route tables…</p></section>`;
  const [routes, encounterTables] = await Promise.all([getRouteIndex(), getEncounterTables()]);
  const speeds = settings().speeds;
  const viable = routes.filter(row => Number(speeds[row.method] || 0) > 0);
  const regions = [...new Set(viable.map(row => row.region))].sort();
  const f = state.routeFilters;
  const regionRows = f.region ? viable.filter(row => row.region === f.region) : [];
  const locations = [...new Set(regionRows.map(row => row.location))].sort((a,b)=>a.localeCompare(b));
  if (f.location && !locations.includes(f.location)) Object.assign(f, {location:"", method:"", season:"All", time:"All"});
  const locationRows = f.location ? regionRows.filter(row => row.location === f.location) : [];
  const methodOrder = new Map(state.methods.map((m,i)=>[m.id,i]));
  const methods = [...new Set(locationRows.map(row => row.method))].sort((a,b)=>(methodOrder.get(a)??99)-(methodOrder.get(b)??99)||a.localeCompare(b));
  if (f.method && !methods.includes(f.method)) Object.assign(f, {method:"", season:"All", time:"All"});
  const methodRows = f.method ? locationRows.filter(row => row.method === f.method) : [];

  const seasonOrder = ["Spring","Summer","Autumn","Winter"];
  const timeOrder = ["Morning","Day","Night"];
  const seasonSet = new Set();
  methodRows.forEach(row => row.availability.forEach(a => {
    if (a.season === "Any") seasonOrder.forEach(x => seasonSet.add(x));
    else seasonSet.add(a.season);
  }));
  const seasons = seasonOrder.filter(x => seasonSet.has(x));
  if (f.season !== "All" && !seasons.includes(f.season)) { f.season = "All"; f.time = "All"; }

  const seasonRows = f.season === "All" ? methodRows : methodRows.filter(row => optionAvailable(row, f.season, "All"));
  const timeSet = new Set();
  seasonRows.forEach(row => row.availability.forEach(a => {
    if (f.season === "All" || a.season === f.season || a.season === "Any") timeSet.add(a.time);
  }));
  const times = timeOrder.filter(x => timeSet.has(x));
  if (f.time !== "All" && !times.includes(f.time)) f.time = "All";

  const results = f.method ? methodRows.filter(row => optionAvailable(row, f.season, f.time)) : [];
  const filteredAvailability = row => row.availability.filter(a =>
    (f.season === "All" || a.season === f.season || a.season === "Any") &&
    (f.time === "All" || a.time === f.time)
  ).map(a => ({...a, season: f.season !== "All" && a.season === "Any" ? f.season : a.season}));
  const filterSummary = [f.method, f.season !== "All" ? f.season : "All seasons", f.time !== "All" ? f.time : "All times"].filter(Boolean).join(" · ");

  $("#app").innerHTML = `<section class="route-searcher-page">
    <div class="section-head"><div><span class="eyebrow">Encounter browser</span><h1 class="page-title">Route Searcher</h1><p>Choose a region, route and method, then narrow the exact encounter tables by season and time.</p></div></div>
    <div class="route-cascade" aria-label="Route search filters">
      <label class="route-step"><span><b>1</b> Region</span><select id="route-region"><option value="">Choose a region…</option>${regions.map(x=>`<option value="${escapeHtml(x)}" ${x===f.region?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></label>
      <label class="route-step ${!f.region?"disabled-step":""}"><span><b>2</b> Route or area</span><select id="route-location" ${!f.region?"disabled":""}><option value="">${f.region?"Choose a route…":"Select a region first"}</option>${locations.map(x=>`<option value="${escapeHtml(x)}" ${x===f.location?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></label>
      <label class="route-step ${!f.location?"disabled-step":""}"><span><b>3</b> Method</span><select id="route-method" ${!f.location?"disabled":""}><option value="">${f.location?"Choose a method…":"Select a route first"}</option>${methods.map(x=>`<option value="${escapeHtml(x)}" ${x===f.method?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></label>
      <label class="route-step ${!f.method?"disabled-step":""}"><span><b>4</b> Season</span><select id="route-season" ${!f.method?"disabled":""}><option value="All">All viable seasons</option>${seasons.map(x=>`<option value="${escapeHtml(x)}" ${x===f.season?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></label>
      <label class="route-step ${!f.method?"disabled-step":""}"><span><b>5</b> Time</span><select id="route-time" ${!f.method?"disabled":""}><option value="All">All viable times</option>${times.map(x=>`<option value="${escapeHtml(x)}" ${x===f.time?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></label>
      <button class="pixel-btn ghost route-reset" id="route-reset" type="button">Reset</button>
    </div>
    ${!f.region ? `<div class="route-guide"><strong>Start with a region.</strong><span>Each following choice only shows options that actually exist for the previous selection.</span></div>` : !f.location ? `<div class="route-guide"><strong>${locations.length} viable areas in ${escapeHtml(f.region)}.</strong><span>Choose one to see only the methods available there.</span></div>` : !f.method ? `<div class="route-guide"><strong>${methods.length} viable ${methods.length===1?"method":"methods"} at ${escapeHtml(f.location)}.</strong><span>Choose a method to unlock its viable seasons and times.</span></div>` : ""}
    ${results.length ? `<div class="route-results-head"><div><h2>${escapeHtml(f.location)}</h2><p>${escapeHtml(f.region)} · ${escapeHtml(filterSummary)} · ${results.length} ${results.length===1?"encounter table":"encounter tables"}</p></div><div class="route-speed"><strong>${formatNumber(Number(speeds[f.method]||0),0)}/hr</strong><small>method speed</small></div></div><div class="route-result-grid">${results.map((row,i)=>`<article class="route-result-card"><div class="route-card-title"><span class="route-result-number">${i+1}</span><span><strong>${escapeHtml(row.encounterType)}</strong><small>Encounter table ${i+1}</small></span></div>${routeSpeciesPreview(encounterTables[String(row.tableId)])}<div class="availability-feature">${availabilityVisual(filteredAvailability(row))}</div><div class="split-summary">${routeTableStatus(row)}</div><button class="pixel-btn small" type="button" data-route-table="${row.tableId}">View full split</button></article>`).join("")}</div>` : f.method ? `<div class="empty-state"><h2>No table matches these filters</h2><p>Try another season or time.</p></div>` : ""}
  </section>`;

  $("#route-region").addEventListener("change", e => { state.routeFilters={region:e.target.value,location:"",method:"",season:"All",time:"All"}; renderRouteSearcher(); });
  $("#route-location").addEventListener("change", e => { Object.assign(state.routeFilters,{location:e.target.value,method:"",season:"All",time:"All"}); renderRouteSearcher(); });
  $("#route-method").addEventListener("change", e => { Object.assign(state.routeFilters,{method:e.target.value,season:"All",time:"All"}); renderRouteSearcher(); });
  $("#route-season").addEventListener("change", e => { state.routeFilters.season=e.target.value; state.routeFilters.time="All"; renderRouteSearcher(); });
  $("#route-time").addEventListener("change", e => { state.routeFilters.time=e.target.value; renderRouteSearcher(); });
  $("#route-reset").addEventListener("click",()=>{state.routeFilters={region:"",location:"",method:"",season:"All",time:"All"};renderRouteSearcher();});
  $$('[data-route-table]').forEach(button=>button.addEventListener('click',()=>{
    const row=results.find(x=>String(x.tableId)===String(button.dataset.routeTable));
    if(row) {
      const filteredRow = {...row, availability: filteredAvailability(row)};
      openEncounterSplit(routeOption(filteredRow),null).catch(error=>{console.error(error);toast("Could not load the encounter split");});
    }
  }));
}


const TRAINING_EV_CATEGORY_FALLBACK = [
  { id: "HP", label: "HP", kind: "pure" },
  { id: "Attack", label: "Attack", kind: "pure" },
  { id: "Defense", label: "Defense", kind: "pure" },
  { id: "Sp. Attack", label: "Sp. Attack", kind: "pure" },
  { id: "Sp. Defense", label: "Sp. Defense", kind: "pure" },
  { id: "Speed", label: "Speed", kind: "pure" },
  { id: "Attack / Speed", label: "Attack / Speed", kind: "split-50-50" },
  { id: "Sp. Attack / Speed", label: "Sp. Attack / Speed", kind: "split-50-50" },
];

function trainingAvailabilityMatches(row, season, time) {
  return (row.availability || []).some(pair =>
    (season === "All" || pair.season === season || pair.season === "Any") &&
    (time === "All" || pair.time === time)
  );
}

function trainingSpeciesPreview(row, { evMode = false } = {}) {
  const species = row.species || [];
  const splitPool = evMode && row.evCategoryKind === "split-50-50";
  return `<div class="training-species-list">${species.map(component => {
    const poolShare = formatPercent(component.share || 0);
    const evText = evMode && component.evStat ? ` · ${component.evYield} ${component.evStat} EV${Number(component.evYield) === 1 ? "" : "s"} each` : "";
    const title = `${component.name} · Lv. ${component.minLevel || "?"}–${component.maxLevel || "?"}${evText} · ${poolShare} of hordes`;
    const detail = evMode
      ? `<small>${component.evYield} ${escapeHtml(component.evStat || "Mixed")}${splitPool ? `<b>${poolShare}</b>` : ""}</small>`
      : `<small>${poolShare} of hordes</small>`;
    return `<a class="training-species" href="${pokemonHref(component.pokemonId)}" title="${escapeHtml(title)}">${imageTag(component.pokemonId, component.name, { icon:true })}<span>${escapeHtml(component.name)}</span>${detail}</a>`;
  }).join("")}</div>`;
}

function trainingRowAsHunt(row) {
  return {
    ...row,
    uiKey: `training-${row.tableId}`,
    minLevel: row.levelMin,
    maxLevel: row.levelMax,
  };
}

function trainingEvBreakdown(row) {
  return Object.entries(row.evExpectedByStat || {})
    .map(([stat, value]) => `${formatNumber(value, Number(value) % 1 ? 1 : 0)} ${escapeHtml(stat)}`)
    .join(" · ");
}

function trainingCard(row, rank, mode) {
  const isEv = mode === "ev";
  const splitPool = isEv && row.evCategoryKind === "split-50-50";
  const variableEv = isEv && Number(row.evMin) !== Number(row.evMax);
  const score = isEv
    ? variableEv ? `${formatNumber(row.evExpected, 1)} avg EV` : `${formatNumber(row.evExpected, 0)} EV`
    : `≈ ${formatNumber(row.estimatedExp, 0)}`;
  const scoreLabel = isEv
    ? splitPool
      ? `per horde · 50% ${escapeHtml(row.evCategory.replace(" / ", " / 50% "))}`
      : variableEv
        ? `${formatNumber(row.evMin, 0)}–${formatNumber(row.evMax, 0)} ${escapeHtml(row.evCategory)} EV per horde`
        : `${escapeHtml(row.evCategory)} per horde`
    : `estimated EXP per horde`;
  const detailLine = isEv
    ? splitPool
      ? `<span class="training-purity split">50/50 mixed pool</span><span>${trainingEvBreakdown(row)} expected over time</span>`
      : `<span class="training-purity">Maximum-yield ${escapeHtml(row.evCategory)} pool</span>`
    : `<span>${formatNumber(row.estimatedExpMin, 0)}–${formatNumber(row.estimatedExpMax, 0)} level-range estimate</span>`;
  return `<article class="training-card">
    <div class="training-rank">${rank}</div>
    <div class="training-card-body">
      <div class="training-card-title"><div><h3>${escapeHtml(row.location)}</h3><p>${escapeHtml(row.region)} · ${escapeHtml(row.encounterType)} · 5× Horde · Lv. ${row.levelMin || "?"}–${row.levelMax || "?"}</p></div><div class="training-card-score"><strong>${score}</strong><small>${scoreLabel}</small></div></div>
      ${trainingSpeciesPreview(row, { evMode:isEv })}
      <div class="training-card-foot"><div class="availability-feature" title="${escapeHtml(availabilityLabel(row.availability || []))}">${availabilityVisual(row.availability || [])}</div><div class="training-card-meta">${detailLine}<span>${escapeHtml(row.confidence || "High")} confidence</span></div><button class="pixel-btn small" type="button" data-training-table="${row.tableId}">View full split</button></div>
    </div>
  </article>`;
}

async function renderTraining() {
  setActiveNav("training");
  setPageTitle("EV & EXP Training");
  $("#app").innerHTML = `<section class="loading-screen"><div class="pixel-loader"></div><p>Sorting maximum-yield EV and high-EXP 5× hordes…</p></section>`;
  const training = await getTrainingIndex();
  const f = state.trainingFilters;
  const isEv = f.mode === "ev";
  const evCategories = training.evCategories?.length ? training.evCategories : TRAINING_EV_CATEGORY_FALLBACK;
  if (!evCategories.some(category => category.id === f.stat)) f.stat = evCategories[0]?.id || "HP";
  const sourceRows = isEv ? (training.evHordes || []) : (training.hordes || []);
  const rows = sourceRows.filter(row => {
    if (isEv && row.evCategory !== f.stat) return false;
    if (f.region !== "All" && row.region !== f.region) return false;
    return trainingAvailabilityMatches(row, f.season, f.time);
  }).sort((a, b) => isEv
    ? Number(b.estimatedExp || 0) - Number(a.estimatedExp || 0) || a.region.localeCompare(b.region) || a.location.localeCompare(b.location)
    : Number(b.estimatedExp || 0) - Number(a.estimatedExp || 0) || Number(b.levelMax || 0) - Number(a.levelMax || 0) || a.location.localeCompare(b.location)
  );
  const regions = ["All", ...new Set(sourceRows.map(row => row.region))];
  const selectedCategory = evCategories.find(category => category.id === f.stat);
  const selectedIsSplit = selectedCategory?.kind === "split-50-50";
  const resultLabel = isEv
    ? `${selectedIsSplit ? "maximum-yield 50/50" : "maximum-yield pure"} 5× horde ${rows.length === 1 ? "spot" : "spots"}`
    : `EXP-ranked 5× horde ${rows.length === 1 ? "spot" : "spots"}`;
  const top = rows[0];
  const visibleRows = rows.slice(0, state.trainingVisible);
  const remainingRows = Math.max(0, rows.length - visibleRows.length);
  const topSummary = top ? isEv
    ? selectedIsSplit
      ? `${top.location} gives ${formatNumber(top.evExpected, 0)} total EV per horde, with a 50% chance for either ${top.evCategory.replace(" / ", " or ")}.`
      : `${top.location} gives the maximum ${Number(top.evMin) === Number(top.evMax) ? `${formatNumber(top.evExpected, 0)} guaranteed` : `${formatNumber(top.evExpected, 1)} average`} ${top.evCategory} EV per horde.`
    : `${top.location} currently leads at approximately ${formatNumber(top.estimatedExp, 0)} base EXP per horde.`
    : "No 5× horde matches the selected filters.";

  $("#app").innerHTML = `<section class="training-page">
    <div class="section-head"><div><span class="eyebrow">5× horde training finder</span><h1 class="page-title">EV & EXP Training</h1><p>Find only the strongest EV-training pools or compare 5× hordes by estimated experience.</p></div></div>
    <div class="training-mode-tabs" role="tablist" aria-label="Training mode">
      <button type="button" role="tab" aria-selected="${isEv}" class="${isEv ? "active" : ""}" data-training-mode="ev"><strong>EV Training</strong><small>Maximum-yield 5× hordes only</small></button>
      <button type="button" role="tab" aria-selected="${!isEv}" class="${!isEv ? "active" : ""}" data-training-mode="exp"><strong>EXP Training</strong><small>Highest estimated 5× horde EXP</small></button>
    </div>
    ${isEv ? `<div class="training-stat-tabs training-category-tabs" role="group" aria-label="EV category">${evCategories.map(category => `<button type="button" class="${category.id === f.stat ? "active" : ""} ${category.kind === "split-50-50" ? "split" : ""}" data-training-stat="${escapeHtml(category.id)}"><span>${escapeHtml(category.label)}</span>${category.kind === "split-50-50" ? `<small>50/50</small>` : `<small>Max ${formatNumber(category.maxExpected || 0, Number(category.maxExpected || 0) % 1 ? 1 : 0)} EV</small>`}</button>`).join("")}</div>` : ""}
    <div class="training-toolbar">
      <label class="field"><span>Region</span><select id="training-region">${regions.map(region => `<option value="${escapeHtml(region)}" ${region === f.region ? "selected" : ""}>${escapeHtml(region)}</option>`).join("")}</select></label>
      <label class="field"><span>Season</span><select id="training-season"><option value="All">All seasons</option>${["Spring","Summer","Autumn","Winter"].map(value => `<option value="${value}" ${value === f.season ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="field"><span>Time</span><select id="training-time"><option value="All">Any time</option>${["Morning","Day","Night"].map(value => `<option value="${value}" ${value === f.time ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <button class="pixel-btn ghost" id="training-reset" type="button">Reset</button>
    </div>
    <div class="training-explainer ${isEv ? "ev" : "exp"}">
      <div><strong>${isEv ? selectedIsSplit ? "These pools are exactly 50/50 between the two listed EV stats." : "Only the highest EV yield found for this stat is shown." : "EXP values are comparable estimates, not exact battle payouts."}</strong><span>${isEv ? selectedIsSplit ? "Each individual horde awards one stat or the other; the displayed split is the chance of receiving each horde. Lower-yield 50/50 pools are excluded." : "Every possible Pokémon awards the selected stat. Lower-yield 5× hordes and all 3× hordes are excluded. Values are before Macho Brace or other modifiers." : "Estimate: base EXP yield × average encounter level ÷ 7 × 5, weighted across split pools. Exp. Share, Lucky Egg and party modifiers are not applied."}</span></div>
      <b>${escapeHtml(topSummary)}</b>
    </div>
    <div class="training-results-head"><div><h2>${isEv ? `${escapeHtml(f.stat)} spots` : "Best EXP hordes"}</h2><p>${rows.length.toLocaleString()} ${resultLabel}</p></div>${top ? `<div class="training-best-chip"><span>Best match</span><strong>${escapeHtml(top.location)}</strong></div>` : ""}</div>
    ${rows.length ? `<div class="training-list">${visibleRows.map((row, index) => trainingCard(row, index + 1, f.mode)).join("")}</div>${remainingRows ? `<div class="training-load-more"><button class="pixel-btn secondary" id="training-more" type="button">Show ${Math.min(40, remainingRows)} more <small>${remainingRows.toLocaleString()} remaining</small></button></div>` : ""}` : `<div class="empty-state"><h2>No matching 5× horde found</h2><p>Try another EV category, region, season or time.</p></div>`}
  </section>`;

  $$('[data-training-mode]').forEach(button => button.addEventListener('click', () => { f.mode = button.dataset.trainingMode; state.trainingVisible = 40; renderTraining(); }));
  $$('[data-training-stat]').forEach(button => button.addEventListener('click', () => { f.stat = button.dataset.trainingStat; state.trainingVisible = 40; renderTraining(); }));
  $("#training-region").addEventListener("change", event => { f.region = event.target.value; state.trainingVisible = 40; renderTraining(); });
  $("#training-season").addEventListener("change", event => { f.season = event.target.value; state.trainingVisible = 40; renderTraining(); });
  $("#training-time").addEventListener("change", event => { f.time = event.target.value; state.trainingVisible = 40; renderTraining(); });
  $("#training-reset").addEventListener("click", () => { state.trainingFilters = { mode:f.mode, stat:"HP", region:"All", season:"All", time:"All" }; state.trainingVisible = 40; renderTraining(); });
  $("#training-more")?.addEventListener("click", () => { state.trainingVisible += 40; renderTraining(); });
  $$('[data-training-table]').forEach(button => button.addEventListener('click', () => {
    const row = rows.find(item => String(item.tableId) === String(button.dataset.trainingTable));
    if (row) openEncounterSplit(trainingRowAsHunt(row), []).catch(error => { console.error(error); toast("Could not load the encounter split"); });
  }));
}

function renderSettings() {
  setActiveNav("settings");
  setPageTitle("Settings");
  const s=settings();
  const effective = effectiveShinyDenominator(s);
  $("#app").innerHTML = `<section>
    <div class="section-head settings-head">
      <div><span class="eyebrow">Personal assumptions</span><h1 class="page-title">Settings</h1><p>Set your shiny odds, display and hunting pace.</p></div>
      <div class="settings-top-actions"><button class="pixel-btn secondary" id="save-settings">Save settings</button><button class="pixel-btn ghost" id="reset-settings">Reset defaults</button></div>
    </div>
    <div class="settings-compact-grid">
      <article class="setting-card shiny-settings-card">
        <div class="setting-card-head"><div><h2>Shiny odds</h2><p>Only used for the estimated time until a shiny.</p></div><div class="mini-input"><label for="base-shiny-denominator">Base denominator</label><input id="base-shiny-denominator" type="number" min="1" step="1" value="${s.baseShinyDenominator}"></div></div>
        <div class="boost-section compact-boost-section"><strong>Active boosts</strong><small>Charm and event bonuses are exclusive within their own group.</small>
          <div class="boost-grid compact-boost-grid">
            <label class="check-card"><input id="boost-donator" type="checkbox" ${s.donatorStatus ? "checked" : ""}><span><b>Donator</b><small>10%</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="charm" data-value="0.05" type="checkbox" ${Number(s.shinyCharm)===0.05 ? "checked" : ""}><span><b>Charm</b><small>5%</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="charm" data-value="0.10" type="checkbox" ${Number(s.shinyCharm)===0.10 ? "checked" : ""}><span><b>Charm</b><small>10%</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.05" type="checkbox" ${Number(s.eventBonus)===0.05 ? "checked" : ""}><span><b>Event</b><small>5%</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.10" type="checkbox" ${Number(s.eventBonus)===0.10 ? "checked" : ""}><span><b>Event</b><small>10%</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.15" type="checkbox" ${Number(s.eventBonus)===0.15 ? "checked" : ""}><span><b>Event</b><small>15%</small></span></label>
          </div>
        </div>
        <div class="odds-preview compact-odds-preview" id="odds-preview"><span>Effective shiny rate</span><strong>≈ 1 / ${Math.round(effective).toLocaleString()}</strong><small>${shinyFormula(s)} = ${formatNumber(effective, effective % 1 ? 1 : 0)}</small></div>
        <label class="toggle-line safari-setting"><input id="adjust-safari-catch" type="checkbox" ${s.adjustSafariCatch ? "checked" : ""}><span><strong>Catch-adjust known Safari hunts</strong><small>Johto Safari and Great Marsh only.</small></span></label>
      </article>
      <article class="setting-card display-settings-card">
        <h2>Display</h2>
        <div class="setting-row"><div><strong>Color theme</strong><small>Light, dark or device setting.</small></div><select id="theme-mode"><option value="light" ${s.theme==="light"?"selected":""}>Light</option><option value="dark" ${s.theme==="dark"?"selected":""}>Dark</option><option value="system" ${s.theme==="system"?"selected":""}>System</option></select></div>
        <div class="setting-row"><div><strong>Default sprites</strong><small>Used across the Pokédex.</small></div><select id="sprite-mode"><option value="normal" ${!s.shinySprites?"selected":""}>Normal</option><option value="shiny" ${s.shinySprites?"selected":""}>Shiny</option></select></div>
        <div class="display-actions"><button class="pixel-btn ghost" id="clear-favorites">Clear favorites</button><a class="text-link" href="#about">Data and calculation notes →</a></div>
      </article>
    </div>
    <details class="setting-card speed-settings-card settings-details">
      <summary><span><strong>Encounter pace</strong><small>Edit the per-hour assumptions used for route rankings.</small></span><b>${state.methods.filter(m=>Number(s.speeds[m.id]||0)>0).length} active methods</b></summary>
      <div class="speed-settings-body"><p class="settings-note">Horde values count individual Pokémon shown, not battle screens.</p><div class="speed-grid">${state.methods.map(m=>`<label class="speed-setting"><span><strong>${escapeHtml(m.label)}</strong><small>Pokémon / hour</small></span><input class="speed-input" data-method="${escapeHtml(m.id)}" type="number" min="0" step="1" value="${Number(s.speeds[m.id]||0)}"></label>`).join("")}</div></div>
    </details>
  </section>`;

  const previewFromForm = () => {
    const temp = settings();
    temp.baseShinyDenominator = Math.max(1, Number($("#base-shiny-denominator").value) || 30000);
    temp.donatorStatus = $("#boost-donator").checked;
    temp.shinyCharm = Number($(".exclusive-boost[data-group='charm']:checked")?.dataset.value || 0);
    temp.eventBonus = Number($(".exclusive-boost[data-group='event']:checked")?.dataset.value || 0);
    const result = effectiveShinyDenominator(temp);
    $("#odds-preview").innerHTML = `<span>Effective shiny rate</span><strong>≈ 1 / ${Math.round(result).toLocaleString()}</strong><small>${shinyFormula(temp)} = ${formatNumber(result, result % 1 ? 1 : 0)}</small>`;
  };
  $$(".exclusive-boost").forEach(box => box.addEventListener("change", () => {
    if (box.checked) $$(`.exclusive-boost[data-group='${box.dataset.group}']`).forEach(other => { if (other !== box) other.checked = false; });
    previewFromForm();
  }));
  $("#boost-donator").addEventListener("change", previewFromForm);
  $("#base-shiny-denominator").addEventListener("input", previewFromForm);
  $("#theme-mode").addEventListener("change", e => applyTheme(e.target.value));
  $("#save-settings").addEventListener("click",()=>{
    const next=settings();
    next.settingsVersion=6;
    next.baseShinyDenominator=Math.max(1,Number($("#base-shiny-denominator").value)||30000);
    next.donatorStatus=$("#boost-donator").checked;
    next.shinyCharm=Number($(".exclusive-boost[data-group='charm']:checked")?.dataset.value||0);
    next.eventBonus=Number($(".exclusive-boost[data-group='event']:checked")?.dataset.value||0);
    next.adjustSafariCatch=$("#adjust-safari-catch").checked;
    next.shinySprites=$("#sprite-mode").value==="shiny";
    next.theme=$("#theme-mode").value;
    $$(".speed-input").forEach(x=>next.speeds[x.dataset.method]=Math.max(0,Number(x.value)||0));
    saveJSON(STORAGE.settings,next);
    applyTheme(next.theme); toast("Settings saved");
  });
  $("#reset-settings").addEventListener("click",()=>{saveJSON(STORAGE.settings,defaultSettings());state.hunterFilters.season="All";state.hunterFilters.time="All";applyTheme("light");toast("Defaults restored");renderSettings();});
  $("#clear-favorites").addEventListener("click",()=>{saveJSON(STORAGE.favorites,[]);toast("Favorites cleared");});
}

function renderAbout() {
  setActiveNav("about");
  setPageTitle("About");
  $("#app").innerHTML = `<section><div class="section-head"><div><span class="eyebrow">About this project</span><h1 class="page-title">About PaxDex</h1><p>A route-first PokeMMO Pokédex built for quick browsing and practical shiny planning.</p></div></div>
    <div class="about-simple-grid">
      <article class="setting-card"><h2>What PaxDex does</h2><p>PaxDex turns the Pokédex dump into compact Pokémon pages, complete encounter splits, route comparisons and pure EV/EXP horde rankings by season and time.</p><p>The Shiny Hunter can rank one exact form or combine every wild form in an evolution line.</p></article>
      <article class="setting-card"><h2>How hunt rankings work</h2><p>Routes are ordered by expected target Pokémon shown per hour using the encounter split and your editable method speeds. Shiny boosts affect the time estimate, not the encounter order.</p><p>The Pokédex uses broader encounter categories: Lure includes every species with a Lure-enabled spot, while Lure-exclusive is reserved for species with no non-Lure wild encounter. Special contains phenomena and other non-standard dump encounters; Fossil contains the revival families. Horde cards may keep both labels, but Split search hides a species when it also has a 100% horde of that size.</p><p>Wild danger markers use the current level-up moves at each encounter level plus normal ability slots; hidden abilities are excluded. Safari views hide battle-only danger markers, and known Johto Safari and Great Marsh hunts can optionally use community catch estimates.</p></article>
      <article class="setting-card"><h2>Data, privacy and credits</h2><p><strong>Current data:</strong> ${state.buildInfo.pokemon} Pokémon, ${Number(state.buildInfo.huntOptions).toLocaleString()} hunt options and ${Number(state.buildInfo.encounterTables || 0).toLocaleString()} encounter splits from <code>dump.zip</code>.</p><p>Favorites and settings stay in this browser on this device. PaxDex has no account system or server-side tracking.</p><p class="credit-line">Made from PokeMMO Pokedex dump with AI usage by [MÜSH] PaulusPax</p><p><strong>Safari estimates:</strong> <a href="https://github.com/ProfessorRex/HGSS-Safari-Zone" target="_blank" rel="noopener noreferrer">ProfessorRex/HGSS-Safari-Zone</a>.</p><p class="project-disclaimer">Unofficial fan-made companion. PaxDex is not affiliated with PokeMMO or The Pokémon Company.</p></article>
    </div></section>`;
}

function renderNotFound() {
  setActiveNav("");
  setPageTitle("Page not found");
  $("#app").innerHTML = `<div class="empty-state"><h1>Page not found</h1><p>That Pokédex page wandered into tall grass.</p><a class="pixel-btn" href="#home">Return home</a></div>`;
}

function bindPokemonCards() {
  $$('[data-favorite]').forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favorite));
  }));
}
function bindCommonClicks() {
  $$('[data-open-pokemon]').forEach(btn=>btn.addEventListener('click',()=>go(pokemonPath(btn.dataset.openPokemon))));
}

async function renderRoute() {
  const [route, arg] = routeParts();
  appFocus();
  try {
    if (route === "home") renderHome();
    else if (route === "dex") renderDex();
    else if (route === "pokemon") {
      const pokemon = resolvePokemonRoute(arg);
      if (!pokemon) renderNotFound();
      else {
        const canonicalHash = `#${pokemonPath(pokemon)}`;
        if (location.hash !== canonicalHash) history.replaceState(null, "", canonicalHash);
        await renderPokemon(pokemon.id);
      }
    }
    else if (route === "hunter") {
      if (!arg) await renderHunter(null);
      else {
        const pokemon = resolvePokemonRoute(arg);
        if (!pokemon) renderNotFound();
        else {
          const canonicalHash = `#${hunterPath(pokemon)}`;
          if (location.hash !== canonicalHash) history.replaceState(null, "", canonicalHash);
          await renderHunter(pokemon.id);
        }
      }
    }
    else if (route === "routes") await renderRouteSearcher();
    else if (route === "training") await renderTraining();
    else if (route === "favorites") renderFavorites();
    else if (route === "settings") renderSettings();
    else if (route === "about") renderAbout();
    else renderNotFound();
  } catch (error) {
    console.error(error);
    $("#app").innerHTML = `<div class="empty-state"><h1>Something went wrong</h1><p>${escapeHtml(error.message)}</p><p>Open PaxDex through GitHub Pages or a local web server; browsers block its JSON files when index.html is opened directly.</p></div>`;
  }
}

async function init() {
  try {
    [state.pokemon, state.methods, state.dexCategories, state.buildInfo] = await Promise.all([
      fetchJSON("data/index.json"), fetchJSON("data/methods.json"), fetchJSON("data/dex-categories.json"), fetchJSON("data/build-info.json")
    ]);
    state.pokemonById = new Map(state.pokemon.map(p=>[p.id,p]));
    state.pokemonBySlug = new Map(state.pokemon.map(p=>[pokemonSlug(p),p]));
    $("#pokemon-list").innerHTML = state.pokemon.map(p=>`<option value="${escapeHtml(p.name)}">#${String(p.id).padStart(3,"0")}</option>`).join("");
    const s = settings();
    if (s.lockSeason && s.currentSeason !== "All") { state.hunterFilters.season = s.currentSeason; state.trainingFilters.season = s.currentSeason; }
    if (s.lockTime && s.currentTime !== "All") { state.hunterFilters.time = s.currentTime; state.trainingFilters.time = s.currentTime; }
    applyTheme(s.theme);
    $("#theme-toggle")?.addEventListener("click", toggleTheme);
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (settings().theme === "system") applyTheme("system"); });
    window.addEventListener("hashchange", () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      renderRoute();
    });
    renderRoute();
  } catch (error) {
    console.error(error);
    $("#app").innerHTML = `<div class="empty-state"><h1>Could not open PaxDex</h1><p>${escapeHtml(error.message)}</p><p>Open it through GitHub Pages or use <strong>START_PAXDEX.bat</strong> for local testing. Opening index.html directly blocks data loading.</p></div>`;
  }
}

init();
