const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  pokemon: [],
  pokemonById: new Map(),
  methods: [],
  buildInfo: null,
  detailCache: new Map(),
  huntCache: new Map(),
  encounterTables: null,
  routeIndex: null,
  activeHuntMap: new Map(),
  dexPage: 1,
  dexFilters: { query: "", method: "All", generation: "All", availability: "Obtainable" },
  routeFilters: { region: "", location: "", method: "", season: "All", time: "All" },
  hunterFilters: { method: "All", region: "All", season: "All", time: "All", confidence: "All" },
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
  settingsVersion: 4,
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
    merged.settingsVersion = 4;
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
function generationFor(id) {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  return 5;
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
async function getEncounterTables() {
  if (!state.encounterTables) state.encounterTables = await fetchJSON("data/encounter-tables.json");
  return state.encounterTables;
}
async function getRouteIndex() {
  if (!state.routeIndex) state.routeIndex = await fetchJSON("data/route-index.json");
  return state.routeIndex;
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

function findPokemon(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const exact = state.pokemon.find(p => p.name.toLowerCase() === q || String(p.id) === q.replace(/^#/, ""));
  return exact || state.pokemon.find(p => p.name.toLowerCase().includes(q));
}

function pokemonCard(p, { shiny = settings().shinySprites, target = "pokemon" } = {}) {
  const fav = favorites().has(p.id);
  return `<article class="pokemon-card" data-pokemon-id="${p.id}">
    <a class="pokemon-card-link" href="#${target}/${p.id}" aria-label="Open ${escapeHtml(p.name)} ${target === "hunter" ? "in Shiny Hunter" : "Pokédex entry"}"></a>
    <span class="number">#${String(p.id).padStart(3, "0")}</span>
    <button class="favorite-star ${fav ? "on" : ""}" type="button" data-favorite="${p.id}" aria-label="${fav ? "Remove" : "Add"} ${escapeHtml(p.name)} ${fav ? "from" : "to"} favorites">★</button>
    <div class="sprite-box">${imageTag(p.id, p.name, { shiny, icon: true })}</div>
    <div><h3>${escapeHtml(p.name)}</h3><div class="type-row">${typeBadges(p.types)}</div></div>
  </article>`;
}

function renderHome() {
  setActiveNav("home");
  setPageTitle();
  const featured = dailyPokemon();
  const recentMons = recent().map(id => state.pokemonById.get(id)).filter(Boolean);
  $("#app").innerHTML = `<section class="hero">
    <div class="hero-copy">
      <span class="eyebrow">A small PokeMMO field guide</span>
      <h1>Find a Pokémon.<br><span>Find its best hunt.</span></h1>
      <p>A calmer Pokédex for quick answers: clean stats, friendly browsing, and a Shiny Hunter that compares every location, method, season and time.</p>
      <form class="search-panel" id="home-search">
        <input name="pokemon" list="pokemon-list" autocomplete="off" placeholder="Search Bulbasaur, Pikachu, #133…" aria-label="Search Pokémon">
        <button class="pixel-btn" type="submit">Open Pokédex</button>
      </form>
      <div class="quick-links">
        <a class="pixel-btn secondary" href="#dex">Browse all Pokémon</a>
        <a class="pixel-btn ghost" href="#hunter">Plan a shiny hunt</a>
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
  $("#today-find")?.addEventListener("click", () => go(`pokemon/${featured.id}`));
  $("#home-search").addEventListener("submit", e => {
    e.preventDefault();
    const p = findPokemon(new FormData(e.currentTarget).get("pokemon") || "");
    if (p) go(`pokemon/${p.id}`); else toast("I couldn't find that Pokémon");
  });
  bindCommonClicks();
}

function filterPokemon() {
  const f = state.dexFilters;
  const q = f.query.trim().toLowerCase();
  return state.pokemon.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !String(p.id).includes(q.replace(/^#/, ""))) return false;
    if (f.method !== "All" && !(p.methods || []).includes(f.method)) return false;
    if (f.generation !== "All" && generationFor(p.id) !== Number(f.generation)) return false;
    if (f.availability === "Obtainable" && !p.obtainable) return false;
    if (f.availability === "Wild" && !p.hasLocations) return false;
    return true;
  });
}

function renderDex() {
  setActiveNav("dex");
  setPageTitle("Pokédex");
  const methodOrder = new Map(state.methods.map((m, i) => [m.id, i]));
  const methods = [...new Set(state.pokemon.flatMap(p => p.methods || []))].sort((a,b)=>(methodOrder.get(a)??99)-(methodOrder.get(b)??99)||a.localeCompare(b));
  const filtered = filterPokemon();
  const visible = filtered.slice(0, state.dexPage * 40);
  $("#app").innerHTML = `<section>
    <div class="section-head"><div><span class="eyebrow">Pocket index</span><h1 class="page-title">Pokédex</h1><p>${filtered.length} Pokémon match your filters.</p></div>
      <button class="pixel-btn secondary" id="dex-shiny">${settings().shinySprites ? "✨ Shiny sprites" : "Normal sprites"}</button>
    </div>
    <div class="toolbar">
      <div class="field"><label>Search</label><input id="dex-query" value="${escapeHtml(state.dexFilters.query)}" placeholder="Name or number"></div>
      <div class="field"><label>Hunt method</label><select id="dex-method"><option>All</option>${methods.map(m => `<option ${m===state.dexFilters.method?"selected":""}>${escapeHtml(m)}</option>`).join("")}</select></div>
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
  $("#dex-method").addEventListener("change", e => { state.dexFilters.method = e.target.value; update(); });
  $("#dex-gen").addEventListener("change", e => { state.dexFilters.generation = e.target.value; update(); });
  $("#dex-availability").addEventListener("change", e => { state.dexFilters.availability = e.target.value; update(); });
  $("#dex-reset").addEventListener("click", () => { state.dexFilters = { query:"", method:"All", generation:"All", availability:"Obtainable" }; update(); });
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
  const ranked = rankHunts(hunts).slice(0, 5);
  $("#app").innerHTML = `<section>
    <a class="back-link" href="#dex">← Back to Pokédex</a>
    <div class="detail-hero">
      <div class="detail-sprite-card">
        <button class="pixel-btn small shiny-toggle ${s.shinySprites?"active":""}" id="detail-shiny">${s.shinySprites?"✨ Shiny":"☆ Normal"}</button>
        ${imageTag(id, p.name, { shiny:s.shinySprites })}
      </div>
      <div class="detail-main panel">
        <span class="detail-number">#${String(id).padStart(3,"0")}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="type-row">${typeBadges(p.types)}</div>
        <div class="detail-actions">
          <a class="pixel-btn" href="#hunter/${id}">Find the best shiny hunt</a>
          <button class="pixel-btn secondary" id="detail-favorite">${fav?"★ Favorited":"☆ Add favorite"}</button>
        </div>
        <div class="fact-grid">
          <div class="fact"><span>Height</span><strong>${detail.heightM} m</strong></div>
          <div class="fact"><span>Weight</span><strong>${detail.weightKg} kg</strong></div>
          <div class="fact"><span>Catch rate</span><strong>${detail.catchRate ?? "—"}</strong></div>
          <div class="fact"><span>Growth</span><strong>${escapeHtml(detail.expType || "—")}</strong></div>
        </div>
      </div>
    </div>
    <div class="detail-layout">
      <div>
        <article class="detail-card"><h2>Base stats</h2><div class="stat-list">${statRows(detail.stats)}</div></article>
        <article class="detail-card"><h2>Evolution family</h2><div class="evo-line">${line.map((mon,i)=>`${i?'<span class="evo-arrow">→</span>':''}<button class="evo-mon" data-open-pokemon="${mon.id}">${imageTag(mon.id,mon.name,{icon:true})}<span>${escapeHtml(mon.name)}</span></button>`).join("")}</div></article>
        <article class="detail-card"><h2>Moves</h2>${Object.entries(detail.moves).sort(([a],[b])=>a.localeCompare(b)).map(([kind,moves])=>`<details class="move-group"><summary>${escapeHtml(kind)} · ${moves.length}</summary><div class="move-list">${moves.map(m=>`<div class="move"><span>${escapeHtml(m.name)}</span>${m.level!=null?`<small>Lv. ${m.level}</small>`:""}</div>`).join("")}</div></details>`).join("") || '<p>No move data.</p>'}</article>
      </div>
      <aside>
        <article class="detail-card"><h2>Abilities</h2><div class="chip-list">${detail.abilities.map(a=>`<span class="chip">${escapeHtml(a.name)}</span>`).join("") || '<span class="chip">—</span>'}</div></article>
        <article class="detail-card"><h2>Breeding</h2><div class="chip-list">${detail.eggGroups.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join("") || '<span class="chip">Cannot breed</span>'}</div></article>
        <article class="detail-card"><h2>Wild held items</h2><div class="chip-list">${detail.heldItems.map(x=>`<span class="chip">${escapeHtml(x.name)}</span>`).join("") || '<span class="chip">None listed</span>'}</div></article>
        <article class="detail-card"><h2>Best hunt preview</h2>${ranked.length ? ranked.map((h,i)=>`<div style="padding:10px 0;border-top:2px solid #ded7bc"><strong>${i+1}. ${escapeHtml(h.location)}</strong><br><small>${escapeHtml(h.method)} · ${formatPercent(h.share)} · ${formatRate(h.targetEph)} target encounters/hr</small></div>`).join("") + `<a class="pixel-btn small" style="margin-top:12px" href="#hunter/${id}">Compare all spots</a>` : '<p>No wild encounter listed.</p>'}</article>
      </aside>
    </div>
  </section>`;
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
    const targetEph = speed * h.share;
    const knownSafariChance = Number(h.safariCapture?.ballsOnlySuccess || 0);
    const safariAdjusted = Boolean(h.safari && s.adjustSafariCatch && knownSafariChance > 0);
    const rankingEph = safariAdjusted ? targetEph * knownSafariChance : targetEph;
    return {
      ...h, speed, targetEph, rankingEph, safariAdjusted,
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

function hunterCard(h, rank) {
  const safariLine = h.safari
    ? h.safariCapture
      ? `<br><span class="safari-inline">${formatPercent(h.safariCapture.ballsOnlySuccess)} balls-only catch estimate${h.safariAdjusted ? " · applied to ranking" : ""}</span>`
      : `<br><span class="safari-inline muted-inline">Safari catch estimate unavailable</span>`
    : "";
  return `<article class="hunter-card">
    <div class="hunter-rank">${rank}</div>
    <div><button class="hunt-location-button" type="button" data-open-hunt="${escapeHtml(h.uiKey)}"><span>${escapeHtml(h.location)}</span><small>View full encounter split ↓</small></button><div class="hunt-meta"><span>${escapeHtml(h.region)}</span><span>${escapeHtml(h.encounterType)}</span><span>Lv. ${h.minLevel || "?"}–${h.maxLevel || "?"}</span><span class="availability-wrap" title="${escapeHtml(availabilityLabel(h.availability))}">${availabilityVisual(h.availability)}</span></div><div style="margin-top:7px"><span class="confidence ${confidenceClass(h.confidence)}">${h.confidence} confidence</span></div></div>
    <div class="hunt-score"><strong>${formatRate(h.targetEph)}/hr</strong><small>${formatPercent(h.share)} target share<br>${hoursLabel(h.hoursPerShiny)} per ${h.safariAdjusted ? "caught " : ""}target shiny${safariLine}</small></div>
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

async function openEncounterSplit(h, targetId) {
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
  const target = state.pokemonById.get(targetId);
  const rows = table.components.map(component => {
    const isTarget = Number(component.pokemonId) === Number(targetId);
    const speciesEph = speed * Number(component.share || 0);
    const slow = component.slowAbilities || [];
    const slowMarker = slow.length ? `<span class="slowdown-marker" title="May add a start-of-battle ability animation/message: ${escapeHtml(slow.join(", "))}"><img src="assets/icons/encounter-slowdown.png" alt="Start-of-battle slowdown warning"><span>${escapeHtml(slow.join(" / "))}</span></span>` : "";
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
      <div class="split-sprite">${imageTag(component.pokemonId, component.name, {icon:true})}${slowMarker}</div>
      <div class="split-species-main"><div class="split-species-title"><a href="#pokemon/${component.pokemonId}">${escapeHtml(component.name)}</a>${isTarget ? '<span class="target-label">Target</span>' : ""}</div>
        <div class="split-metrics">
          <span><strong>${formatPercent(methodRollChance, 1)}</strong> ${rollLabel} contain ${escapeHtml(component.name)}</span>
          <span><strong>${formatPercent(component.share, 1)}</strong> of all Pokémon shown</span>
          <span><strong>${formatRate(speciesEph)}/hr</strong> at the current method speed</span>
          <span>Lv. ${component.minLevel || "?"}–${component.maxLevel || "?"}</span>
        </div>${sourceHtml}${safariHtml}</div>
    </article>`;
  }).join("");
  const safariNote = table.safari ? `<div class="split-source"><strong>Safari estimates:</strong> balls-only calculations from ProfessorRex/HGSS-Safari-Zone. Applied to Johto Safari and Sinnoh Great Marsh where a species match exists; Kanto and Hoenn remain unadjusted.</div>` : "";
  const affectedSlowdowns = table.components.filter(component => (component.slowAbilities || []).length);
  const slowdownLegend = affectedSlowdowns.length ? `<div class="slowdown-legend"><img src="assets/icons/encounter-slowdown.png" alt=""><span><strong>${affectedSlowdowns.length} ${affectedSlowdowns.length === 1 ? "species has" : "species have"} a possible start-of-battle delay.</strong> The red arrow is shown only on affected Pokémon; hover it to see the relevant ${affectedSlowdowns.length === 1 ? "ability" : "abilities"}.</span></div>` : "";
  const isSweetScent = table.method.includes("Horde");
  const rawLabel = isSweetScent ? "Raw Dex horde block" : "Encounter outcome table";
  const shownSummary = table.containsRandomHordes ? `<span>Avg. ${formatNumber(Number(table.shownTableTotal || 1), 2)} Pokémon shown / encounter roll</span>` : "";
  const explanation = isSweetScent
    ? "Sweet Scent takes the extracted horde block and normalizes it to a 100% method table. Raw Dex percentages are shown only as the source block."
    : table.method.startsWith("Lure")
      ? "The no-Lure encounter table totals 100%, including natural hordes. In this 5% Lure model, every existing outcome is multiplied by 95%, then the Lure-exclusive outcome is inserted at 5%. Pokémon-shown shares weight 3×/5× hordes by their size."
      : "Encounter outcomes total 100%, including natural hordes. Pokémon-shown shares are a second view used for shiny efficiency and weight 3×/5× hordes by their size.";
  const calculationNotes = `<details class="calculation-notes"><summary>Calculation notes</summary><div><p>${escapeHtml(explanation)}</p><p>${escapeHtml(table.note)}</p>${safariNote}</div></details>`;
  content.innerHTML = `<div class="split-head"><div><span class="eyebrow">Full encounter split</span><h2>${escapeHtml(table.location)}</h2><p><strong>${escapeHtml(table.method)}</strong> · ${escapeHtml(table.region)} · ${escapeHtml(table.encounterType)}</p></div><div class="split-speed"><strong>${formatNumber(speed,0)}/hr</strong><small>Pokémon shown</small></div></div>
    <div class="availability-feature">${availabilityVisual(h.availability)}</div>
    <div class="split-summary"><span>${rawLabel}: ${formatPercent(table.rawTableTotal, table.rawTableTotal < .1 ? 1 : 0)}</span>${isSweetScent ? '<span>Sweet Scent table: 100%</span>' : ''}${shownSummary}<span>${escapeHtml(table.confidence)} confidence</span><span>${table.components.length} species</span></div>
    ${slowdownLegend}
    <div class="split-list">${rows}</div>
    ${calculationNotes}`;
  $$('a[href^="#pokemon/"]', content).forEach(link => link.addEventListener('click', () => dialog.close()));
}

function bindEncounterSplitButtons(targetId) {
  $$('[data-open-hunt]').forEach(button => button.addEventListener('click', () => {
    const hunt = state.activeHuntMap.get(button.dataset.openHunt);
    if (hunt) openEncounterSplit(hunt, targetId).catch(error => { console.error(error); toast("Could not load the encounter split"); });
  }));
}

async function renderHunter(id = null) {
  setActiveNav("hunter");
  const s = settings();
  if (s.lockSeason && s.currentSeason !== "All") state.hunterFilters.season = s.currentSeason;
  if (s.lockTime && s.currentTime !== "All") state.hunterFilters.time = s.currentTime;

  if (!id) {
    setPageTitle("Shiny Hunter");
    const favMons = [...favorites()].map(x => state.pokemonById.get(x)).filter(Boolean);
    $("#app").innerHTML = `<section>
      <div class="section-head"><div><span class="eyebrow">Route planner</span><h1 class="page-title">Shiny Hunter</h1><p>Choose a Pokémon and compare its best location, method, season and time.</p></div></div>
      <div class="panel hunter-start-panel">
        <form class="search-panel" id="hunter-search">
          <input name="pokemon" list="pokemon-list" autocomplete="off" placeholder="Which Pokémon are you hunting?" aria-label="Select Pokémon">
          <button class="pixel-btn" type="submit">Find hunts</button>
        </form>
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
    $("#hunter-search").addEventListener("submit", e => { e.preventDefault(); const p=findPokemon(new FormData(e.currentTarget).get("pokemon")||""); if(p)go(`hunter/${p.id}`);else toast("I couldn't find that Pokémon"); });
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
  const hunts = await getHunts(id);
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
  $("#app").innerHTML = `<section class="hunter-shell">
    <a class="back-link" href="#hunter">← Choose another Pokémon</a>
    <div class="hunter-banner">${imageTag(id,p.name,{shiny:true})}<div><span class="eyebrow">Shiny route planner</span><h1>${escapeHtml(p.name)}</h1></div><a class="pixel-btn secondary" href="#pokemon/${id}">Open Pokédex entry</a></div>
    <div class="toolbar hunter-filters">
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
    ${best ? `<article class="best-hunt"><div><span class="eyebrow">Best matching option</span><button type="button" class="best-location-button" data-open-hunt="${escapeHtml(best.uiKey)}"><span>${escapeHtml(best.location)}</span><small>Open the full ${escapeHtml(best.method)} split ↓</small></button><p><strong>${escapeHtml(best.method)}</strong> · ${escapeHtml(best.region)}</p><div class="availability-feature">${availabilityVisual(best.availability)}</div><div class="chip-list"><span class="chip">${escapeHtml(best.encounterType)}</span><span class="chip">Lv. ${best.minLevel||"?"}–${best.maxLevel||"?"}</span><span class="chip ${confidenceClass(best.confidence)}">${best.confidence} confidence</span></div></div><div><div class="big-number">${formatRate(best.targetEph)}<small>${escapeHtml(p.name)} encounters/hour</small></div><div class="metric-grid"><div class="metric"><span>Target share</span><strong>${formatPercent(best.share)}</strong></div><div class="metric"><span>Method speed</span><strong>${formatNumber(best.speed,0)}/hr</strong></div><div class="metric"><span>Expected ${best.safariAdjusted ? "caught " : ""}target shiny</span><strong>${hoursLabel(best.hoursPerShiny)}</strong></div><div class="metric"><span>${best.safariCapture ? "Balls-only catch" : "Current shiny rate"}</span><strong>${best.safariCapture ? formatPercent(best.safariCapture.ballsOnlySuccess) : `≈ 1 / ${Math.round(effectiveDenominator).toLocaleString()}`}</strong></div></div></div></article>` : `<div class="empty-state"><h2>No matching hunt found</h2><p>Try clearing a season, time or method filter.</p></div>`}
    ${best ? methodOrder.map(method => `<section class="method-section"><h2 class="method-title">${escapeHtml(method)}</h2><div class="hunt-list">${byMethod.get(method).slice(0,8).map((h,i)=>hunterCard(h,i+1)).join("")}</div></section>`).join("") : ""}
  </section>`;
  const rerender = () => renderHunter(id);
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
  bindEncounterSplitButtons(id);
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

async function renderRouteSearcher() {
  setActiveNav("routes");
  setPageTitle("Route Searcher");
  $("#app").innerHTML = `<section class="loading-screen"><div class="pixel-loader"></div><p>Opening route tables…</p></section>`;
  const routes = await getRouteIndex();
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
    ${results.length ? `<div class="route-results-head"><div><h2>${escapeHtml(f.location)}</h2><p>${escapeHtml(f.region)} · ${escapeHtml(filterSummary)} · ${results.length} ${results.length===1?"encounter table":"encounter tables"}</p></div><div class="route-speed"><strong>${formatNumber(Number(speeds[f.method]||0),0)}/hr</strong><small>method speed</small></div></div><div class="route-result-grid">${results.map((row,i)=>`<article class="route-result-card"><div><span class="route-result-number">${i+1}</span><strong>${escapeHtml(row.encounterType)}</strong></div><div class="availability-feature">${availabilityVisual(filteredAvailability(row))}</div><div class="split-summary"><span>${escapeHtml(row.confidence)} confidence</span><span>${row.containsRandomHordes ? "Includes natural horde roll" : `Raw ${formatPercent(row.rawTableTotal,row.rawTableTotal<.1?1:0)}`}</span></div><button class="pixel-btn small" type="button" data-route-table="${row.tableId}">View full split</button></article>`).join("")}</div>` : f.method ? `<div class="empty-state"><h2>No table matches these filters</h2><p>Try another season or time.</p></div>` : ""}
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

function renderSettings() {
  setActiveNav("settings");
  setPageTitle("Settings");
  const s=settings();
  const effective = effectiveShinyDenominator(s);
  $("#app").innerHTML = `<section>
    <div class="section-head settings-head">
      <div><span class="eyebrow">Personal assumptions</span><h1 class="page-title">Settings</h1><p>Adjust shiny odds, display and encounter pace.</p></div>
      <div class="settings-top-actions"><button class="pixel-btn secondary" id="save-settings">Save settings</button><button class="pixel-btn ghost" id="reset-settings">Reset defaults</button></div>
    </div>
    <div class="settings-stack">
      <div class="settings-columns"><div class="settings-column"><article class="setting-card shiny-settings-card">
        <h2>Shiny calculation</h2>
        <div class="setting-row"><div><strong>Base shiny denominator</strong><small>The normal PokeMMO base is 30,000.</small></div><input id="base-shiny-denominator" type="number" min="1" step="1" value="${s.baseShinyDenominator}"></div>
        <div class="boost-section"><strong>Active boosts</strong><small>Select the boosts active for your hunt. Charm and event options are exclusive within their group.</small>
          <div class="boost-grid">
            <label class="check-card"><input id="boost-donator" type="checkbox" ${s.donatorStatus ? "checked" : ""}><span><b>Donator Status</b><small>10% bonus</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="charm" data-value="0.05" type="checkbox" ${Number(s.shinyCharm)===0.05 ? "checked" : ""}><span><b>Shiny Charm 5%</b><small>Linked charm</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="charm" data-value="0.10" type="checkbox" ${Number(s.shinyCharm)===0.10 ? "checked" : ""}><span><b>Shiny Charm 10%</b><small>Personal charm</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.05" type="checkbox" ${Number(s.eventBonus)===0.05 ? "checked" : ""}><span><b>Event bonus 5%</b><small>Wild boost</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.10" type="checkbox" ${Number(s.eventBonus)===0.10 ? "checked" : ""}><span><b>Event bonus 10%</b><small>Wild boost</small></span></label>
            <label class="check-card"><input class="exclusive-boost" data-group="event" data-value="0.15" type="checkbox" ${Number(s.eventBonus)===0.15 ? "checked" : ""}><span><b>Event bonus 15%</b><small>Wild boost</small></span></label>
          </div>
        </div>
        <div class="odds-preview" id="odds-preview"><span>Effective shiny rate</span><strong>≈ 1 / ${Math.round(effective).toLocaleString()}</strong><small>${shinyFormula(s)} = ${formatNumber(effective, effective % 1 ? 1 : 0)}</small></div>
        <label class="toggle-line safari-setting"><input id="adjust-safari-catch" type="checkbox" ${s.adjustSafariCatch ? "checked" : ""}><span><strong>Catch-adjust known Safari hunts</strong><small>Use available Johto Safari and Great Marsh catch estimates.</small></span></label>
      </article>
      <article class="setting-card hunter-availability-settings">
        <h2>Hunter availability</h2>
        <p>Set the season and time you are currently hunting in.</p>
        <div class="setting-choice-block"><strong>Season</strong>${iconChoiceGroup("season", ["All","Spring","Summer","Autumn","Winter"], s.currentSeason, "Default hunting season")}<label class="toggle-line"><input id="settings-lock-season" type="checkbox" ${s.lockSeason ? "checked" : ""}><span>Keep this season fixed in Shiny Hunter</span></label></div>
        <div class="setting-choice-block"><strong>Time of day</strong>${iconChoiceGroup("time", ["All","Morning","Day","Night"], s.currentTime, "Default hunting time")}<label class="toggle-line"><input id="settings-lock-time" type="checkbox" ${s.lockTime ? "checked" : ""}><span>Keep this time fixed in Shiny Hunter</span></label></div>
      </article></div><div class="settings-column">
      <article class="setting-card">
        <h2>Display</h2>
        <div class="setting-row"><div><strong>Color theme</strong><small>Choose light, dark or follow the device.</small></div><select id="theme-mode"><option value="light" ${s.theme==="light"?"selected":""}>Light</option><option value="dark" ${s.theme==="dark"?"selected":""}>Dark</option><option value="system" ${s.theme==="system"?"selected":""}>System</option></select></div>
        <div class="setting-row"><div><strong>Default sprites</strong><small>Used throughout the Pokédex.</small></div><select id="sprite-mode"><option value="normal" ${!s.shinySprites?"selected":""}>Normal</option><option value="shiny" ${s.shinySprites?"selected":""}>Shiny</option></select></div>
        <button class="pixel-btn ghost" id="clear-favorites">Clear favorites</button>
      </article>
      <article class="setting-card compact-data-card"><h2>Data status</h2><div class="notice">${state.buildInfo.pokemon} Pokémon · ${Number(state.buildInfo.huntOptions).toLocaleString()} hunt options · ${Number(state.buildInfo.encounterTables || 0).toLocaleString()} complete encounter splits · source: dump.zip.</div><p><strong>Confidence labels:</strong> High means the encounter block is structurally complete. Medium usually means a Lure estimate or an unusual table shape. Low indicates a possibly incomplete or special encounter table.</p></article>
      </div></div>
      <article class="setting-card full-settings-card"><h2>Encounters per hour</h2><p class="notice warning">These are planning assumptions, not fixed game values. Horde values count individual Pokémon shown, not battle screens.</p>${state.methods.map(m=>`<div class="setting-row"><div><strong>${escapeHtml(m.label)}</strong><small>Individual Pokémon shown per hour</small></div><input class="speed-input" data-method="${escapeHtml(m.id)}" type="number" min="0" step="1" value="${Number(s.speeds[m.id]||0)}"></div>`).join("")}</article>
    </div>
  </section>`;

  let selectedSeason = s.currentSeason;
  let selectedTime = s.currentTime;
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
  $$('[data-season-choice]').forEach(btn => btn.addEventListener('click', () => {
    selectedSeason = btn.dataset.seasonChoice;
    $$('[data-season-choice]').forEach(x => { x.classList.toggle('active', x === btn); x.setAttribute('aria-pressed', x === btn); });
  }));
  $$('[data-time-choice]').forEach(btn => btn.addEventListener('click', () => {
    selectedTime = btn.dataset.timeChoice;
    $$('[data-time-choice]').forEach(x => { x.classList.toggle('active', x === btn); x.setAttribute('aria-pressed', x === btn); });
  }));
  $("#save-settings").addEventListener("click",()=>{
    const next=settings();
    next.settingsVersion=4;
    next.baseShinyDenominator=Math.max(1,Number($("#base-shiny-denominator").value)||30000);
    next.donatorStatus=$("#boost-donator").checked;
    next.shinyCharm=Number($(".exclusive-boost[data-group='charm']:checked")?.dataset.value||0);
    next.eventBonus=Number($(".exclusive-boost[data-group='event']:checked")?.dataset.value||0);
    next.adjustSafariCatch=$("#adjust-safari-catch").checked;
    next.shinySprites=$("#sprite-mode").value==="shiny";
    next.theme=$("#theme-mode").value;
    next.lockSeason=$("#settings-lock-season").checked;
    next.currentSeason=selectedSeason;
    next.lockTime=$("#settings-lock-time").checked;
    next.currentTime=selectedTime;
    $$(".speed-input").forEach(x=>next.speeds[x.dataset.method]=Math.max(0,Number(x.value)||0));
    saveJSON(STORAGE.settings,next);
    state.hunterFilters.season = next.lockSeason ? next.currentSeason : state.hunterFilters.season;
    state.hunterFilters.time = next.lockTime ? next.currentTime : state.hunterFilters.time;
    applyTheme(next.theme); toast("Settings saved");
  });
  $("#reset-settings").addEventListener("click",()=>{saveJSON(STORAGE.settings,defaultSettings());state.hunterFilters.season="All";state.hunterFilters.time="All";applyTheme("light");toast("Defaults restored");renderSettings();});
  $("#clear-favorites").addEventListener("click",()=>{saveJSON(STORAGE.favorites,[]);toast("Favorites cleared");});
}

function renderAbout() {
  setActiveNav("about");
  setPageTitle("About");
  $("#app").innerHTML = `<section><div class="section-head"><div><span class="eyebrow">About this project</span><h1 class="page-title">About PaxDex</h1><p>A small browser companion for the PokeMMO Pokédex.</p></div></div>
    <div class="about-grid">
      <div class="about-column"><article class="setting-card"><h2>Credits</h2><p class="credit-line">Made from PokeMMO Pokedex dump with AI usage by [MÜSH] PaulusPax</p><div class="notice"><strong>Pokédex source:</strong> dump.zip</div><p><strong>Safari estimates:</strong> <a href="https://github.com/ProfessorRex/HGSS-Safari-Zone" target="_blank" rel="noopener noreferrer">ProfessorRex/HGSS-Safari-Zone</a> — community-derived balls-only catch and flee estimates for Johto Safari and Sinnoh Great Marsh.</p><p class="project-disclaimer">Unofficial fan-made companion. PaxDex is not affiliated with PokeMMO or The Pokémon Company.</p></article><article class="setting-card"><h2>How hunt rankings work</h2><p>Hunts are ordered by expected target Pokémon shown per hour using the encounter split and your editable method speeds. Shiny boosts change the estimated time, not the encounter ranking.</p><p>When enabled, known Johto Safari and Great Marsh hunts are adjusted by their estimated chance of catching the shiny. Technical table details remain available under <strong>Calculation notes</strong> in each full encounter split.</p></article></div>
      <div class="about-column"><article class="setting-card"><h2>Browser storage</h2><p>Favorites and settings stay in this browser on this device. PaxDex has no account system or server-side tracking.</p></article><article class="setting-card"><h2>Today's Find</h2><p>Today's Find uses your local calendar date to select one obtainable Pokémon. It changes at local midnight.</p></article><article class="setting-card"><h2>Current data</h2><p>${state.buildInfo.pokemon} Pokémon, ${Number(state.buildInfo.huntOptions).toLocaleString()} hunt options and ${Number(state.buildInfo.encounterTables || 0).toLocaleString()} full encounter splits are currently loaded.</p></article></div>
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
  $$('[data-open-pokemon]').forEach(btn=>btn.addEventListener('click',()=>go(`pokemon/${btn.dataset.openPokemon}`)));
}

async function renderRoute() {
  const [route, arg] = routeParts();
  appFocus();
  try {
    if (route === "home") renderHome();
    else if (route === "dex") renderDex();
    else if (route === "pokemon") await renderPokemon(Number(arg));
    else if (route === "hunter") await renderHunter(arg ? Number(arg) : null);
    else if (route === "routes") await renderRouteSearcher();
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
    [state.pokemon, state.methods, state.buildInfo] = await Promise.all([
      fetchJSON("data/index.json"), fetchJSON("data/methods.json"), fetchJSON("data/build-info.json")
    ]);
    state.pokemonById = new Map(state.pokemon.map(p=>[p.id,p]));
    $("#pokemon-list").innerHTML = state.pokemon.map(p=>`<option value="${escapeHtml(p.name)}">#${String(p.id).padStart(3,"0")}</option>`).join("");
    const s = settings();
    if (s.lockSeason && s.currentSeason !== "All") state.hunterFilters.season = s.currentSeason;
    if (s.lockTime && s.currentTime !== "All") state.hunterFilters.time = s.currentTime;
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
