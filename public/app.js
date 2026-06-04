const PET_STATES = [
  { id: "idle", label: "Idle", row: 0, frames: 6, durationMs: 1100 },
  { id: "running-right", label: "Run Right", row: 1, frames: 8, durationMs: 1060 },
  { id: "running-left", label: "Run Left", row: 2, frames: 8, durationMs: 1060 },
  { id: "waving", label: "Waving", row: 3, frames: 4, durationMs: 700 },
  { id: "jumping", label: "Jumping", row: 4, frames: 5, durationMs: 840 },
  { id: "failed", label: "Failed", row: 5, frames: 8, durationMs: 1220 },
  { id: "waiting", label: "Waiting", row: 6, frames: 6, durationMs: 1010 },
  { id: "running", label: "Running", row: 7, frames: 6, durationMs: 820 },
  { id: "review", label: "Review", row: 8, frames: 6, durationMs: 1030 },
];

const COLOR_FAMILIES = [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
  "neutral",
];

const FAMILY_DOT = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  brown: "#a16207",
  neutral: "#737373",
};

const DEFAULT_ACCENT = "#6478f6";

const state = {
  pets: [],
  filteredPets: [],
  activeKinds: new Set(),
  activeVibes: new Set(),
  activeColors: new Set(),
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  clearButton: document.querySelector("#clearButton"),
  clearTopButton: document.querySelector("#clearTopButton"),
  filtersButton: document.querySelector("#filtersButton"),
  closeFiltersButton: document.querySelector("#closeFiltersButton"),
  filterSheet: document.querySelector("#filterSheet"),
  desktopFilters: document.querySelector("#desktopFilters"),
  sheetFilters: document.querySelector("#sheetFilters"),
  statusText: document.querySelector("#statusText"),
  endText: document.querySelector("#endText"),
  galleryEyebrow: document.querySelector("#galleryEyebrow"),
  galleryGrid: document.querySelector("#galleryGrid"),
  template: document.querySelector("#petCardTemplate"),
};

init();

async function init() {
  bindControls();
  try {
    const response = await fetch("./pets.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`pets.json returned HTTP ${response.status}`);
    const snapshot = await response.json();
    state.pets = Array.isArray(snapshot.pets) ? snapshot.pets : [];
    renderFilters();
    render();
  } catch (error) {
    elements.statusText.textContent = `Petdex snapshot could not load: ${error.message}`;
  }
}

function bindControls() {
  elements.searchInput.addEventListener("input", render);
  elements.sortSelect.addEventListener("change", render);
  elements.clearSearchButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    render();
  });
  elements.clearButton.addEventListener("click", clearFilters);
  elements.clearTopButton.addEventListener("click", clearFilters);
  elements.filtersButton.addEventListener("click", openFilters);
  elements.closeFiltersButton.addEventListener("click", closeFilters);
  elements.filterSheet.addEventListener("click", (event) => {
    if (event.target === elements.filterSheet) closeFilters();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.filterSheet.hidden) closeFilters();
  });
}

function renderFilters() {
  const kinds = uniqueValues(state.pets.map((pet) => pet.kind));
  const vibes = uniqueValues(state.pets.flatMap((pet) => pet.vibes || []));
  const colors = COLOR_FAMILIES.filter((color) =>
    state.pets.some((pet) => String(pet.colorFamily || "").toLowerCase() === color),
  );

  const groups = [
    { label: "Type", tone: "kind", values: kinds, counts: countValues(state.pets.map((pet) => pet.kind)) },
    { label: "Vibe", tone: "vibe", values: vibes, counts: countValues(state.pets.flatMap((pet) => pet.vibes || [])) },
    { label: "Color", tone: "color", values: colors, counts: countValues(state.pets.map((pet) => pet.colorFamily)) },
  ];

  elements.desktopFilters.replaceChildren(...groups.map((group) => renderFilterRow(group)));
  elements.sheetFilters.replaceChildren(...groups.map((group) => renderFilterGroup(group)));
}

function renderFilterRow(group) {
  const row = document.createElement("div");
  row.className = "filter-row";
  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = group.label;
  const wrap = document.createElement("div");
  wrap.className = "chip-wrap";
  group.values.forEach((value) => wrap.append(renderFilterChip(group, value)));
  row.append(label, wrap);
  return row;
}

function renderFilterGroup(group) {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-group";
  const label = document.createElement("p");
  label.className = "filter-label";
  label.textContent = group.label;
  const wrap = document.createElement("div");
  wrap.className = "chip-wrap";
  group.values.forEach((value) => wrap.append(renderFilterChip(group, value)));
  wrapper.append(label, wrap);
  return wrapper;
}

function renderFilterChip(group, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-chip";
  button.dataset.tone = group.tone;
  button.dataset.value = value;
  button.setAttribute("aria-pressed", String(activeSet(group.tone).has(value)));

  const dot = document.createElement("span");
  dot.className = "chip-dot";
  if (group.tone === "color") dot.style.backgroundColor = FAMILY_DOT[value] || DEFAULT_ACCENT;

  const text = document.createElement("span");
  text.textContent = value;

  const count = document.createElement("span");
  count.className = "chip-count";
  count.textContent = String(group.counts[value] || 0);

  button.append(dot, text, count);
  button.addEventListener("click", () => {
    toggleFilter(group.tone, value);
    syncFilterPressedState();
    render();
  });
  return button;
}

function activeSet(tone) {
  if (tone === "kind") return state.activeKinds;
  if (tone === "vibe") return state.activeVibes;
  return state.activeColors;
}

function toggleFilter(tone, value) {
  const set = activeSet(tone);
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function syncFilterPressedState() {
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(activeSet(chip.dataset.tone).has(chip.dataset.value)));
  });
}

function render() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const sort = elements.sortSelect.value;

  state.filteredPets = state.pets
    .filter((pet) => matchesQuery(pet, query))
    .filter((pet) => state.activeKinds.size === 0 || state.activeKinds.has(pet.kind))
    .filter((pet) => state.activeVibes.size === 0 || (pet.vibes || []).some((vibe) => state.activeVibes.has(vibe)))
    .filter((pet) => state.activeColors.size === 0 || state.activeColors.has(String(pet.colorFamily || "").toLowerCase()))
    .sort(sortPets(sort));

  elements.galleryGrid.replaceChildren();
  if (state.filteredPets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-results";
    empty.textContent = "No pets found. Try clearing filters.";
    elements.galleryGrid.append(empty);
  } else {
    state.filteredPets.forEach((pet, index) => {
      elements.galleryGrid.append(renderPetCard(pet, index));
    });
  }

  const filtersActive = hasActiveFilters();
  elements.clearButton.hidden = !filtersActive;
  elements.clearTopButton.hidden = !filtersActive;
  elements.clearSearchButton.hidden = elements.searchInput.value.length === 0;
  elements.filtersButton.textContent = activeFilterCount() > 0 ? `Filters (${activeFilterCount()})` : "Filters";
  elements.galleryEyebrow.textContent = `Gallery · ${state.pets.length} pets`;
  elements.statusText.textContent = filtersActive
    ? `${state.filteredPets.length} matches`
    : `${state.filteredPets.length} pets`;
  elements.endText.hidden = state.filteredPets.length === 0;
  elements.endText.textContent = `End of gallery · ${state.filteredPets.length} shown`;
}

function renderPetCard(pet, index) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const accent = accentForPet(pet);
  const rgb = hexToRgb(accent).join(" ");
  const metrics = {
    likeCount: metric(pet, "likeCount"),
    installCount: metric(pet, "installCount"),
  };

  card.style.setProperty("--pet-accent", accent);
  card.style.setProperty("--pet-accent-rgb", rgb);
  card.querySelector(".dex-number").textContent = `No. ${String(index + 1).padStart(3, "0")}`;
  card.querySelector(".install-count-badge").textContent =
    metrics.installCount > 0 ? `${compactCount(metrics.installCount)} installs` : "";
  card.querySelector("h2").textContent = pet.displayName || pet.slug || "Pet";
  card.querySelector(".kind").textContent = pet.kind || "";
  card.querySelector(".description").textContent = pet.description || "";
  card.querySelector(".batch").textContent = batchLabel(pet.approvedAt);
  card.querySelector(".author").textContent = authorLabel(pet);
  card.querySelector(".like-count").textContent = metrics.likeCount > 0 ? compactCount(metrics.likeCount) : "";
  card.querySelector(".pet-sprite-frame").setAttribute("aria-label", `${pet.displayName || pet.slug || "Pet"} animated`);
  if (pet.featured) card.classList.add("featured");

  const tags = card.querySelector(".tags");
  [...new Set([...(pet.vibes || []), ...(pet.tags || [])])].slice(0, 5).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = `#${tag}`;
    tags.append(chip);
  });

  applySprite(card.querySelector(".pet-sprite"), pet.spritesheetUrl || pet.spritesheetPath);

  bindCardActions(card, pet);
  return card;
}

function applySprite(sprite, spritesheetUrl) {
  if (!spritesheetUrl) {
    sprite.classList.add("missing");
    return;
  }
  const animation = PET_STATES[hashString(spritesheetUrl) % PET_STATES.length] || PET_STATES[0];
  sprite.style.setProperty("--sprite-url", `url("${cssUrl(spritesheetUrl)}")`);
  sprite.style.setProperty("--sprite-row", String(animation.row));
  sprite.style.setProperty("--sprite-frames", String(animation.frames));
  sprite.style.setProperty("--sprite-duration", `${animation.durationMs}ms`);
}

function bindCardActions(card, pet) {
  const installButton = card.querySelector(".install-button");
  const downloadButton = card.querySelector(".download-action");
  const shareButton = card.querySelector(".share-action");
  const hint = card.querySelector(".install-hint");

  if (!pet.zipUrl) {
    installButton.disabled = true;
    downloadButton.disabled = true;
    hint.textContent = "No ZIP package is available for this pet.";
  } else {
    installButton.addEventListener("click", () => {
      hint.textContent = "Opening Pet Overlay app...";
      window.location.href = installLink(pet);
      window.setTimeout(() => {
        hint.textContent = "If the app did not open, install Pet Overlay first.";
      }, 1400);
    });
    downloadButton.addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = pet.zipUrl;
      link.download = `${pet.slug || "pet"}.zip`;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    });
  }

  shareButton.addEventListener("click", async () => {
    const shareUrl = new URL(window.location.href);
    if (pet.slug) shareUrl.hash = pet.slug;
    const title = pet.displayName || pet.slug || "Petdex pet";
    if (navigator.share) {
      await navigator.share({ title, url: shareUrl.toString() }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl.toString()).catch(() => {});
      hint.textContent = "Pet link copied.";
    } else {
      hint.textContent = shareUrl.toString();
    }
  });
}

function matchesQuery(pet, query) {
  if (!query) return true;
  const haystack = [
    pet.displayName,
    pet.slug,
    pet.description,
    pet.kind,
    pet.submittedByName,
    pet.submittedBy?.name,
    ...(pet.vibes || []),
    ...(pet.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function sortPets(sort) {
  return (left, right) => {
    if (sort === "installed") return metric(right, "installCount") - metric(left, "installCount");
    if (sort === "popular") return metric(right, "likeCount") - metric(left, "likeCount");
    if (sort === "alpha") return String(left.displayName || left.slug).localeCompare(String(right.displayName || right.slug));
    return new Date(right.approvedAt || 0).getTime() - new Date(left.approvedAt || 0).getTime();
  };
}

function metric(pet, key) {
  return Number(pet?.metrics?.[key] ?? pet?.[key] ?? 0);
}

function openFilters() {
  elements.filterSheet.hidden = false;
  elements.closeFiltersButton.focus();
}

function closeFilters() {
  elements.filterSheet.hidden = true;
  elements.filtersButton.focus();
}

function clearFilters() {
  elements.searchInput.value = "";
  state.activeKinds.clear();
  state.activeVibes.clear();
  state.activeColors.clear();
  syncFilterPressedState();
  render();
}

function hasActiveFilters() {
  return elements.searchInput.value.trim().length > 0 || activeFilterCount() > 0;
}

function activeFilterCount() {
  return state.activeKinds.size + state.activeVibes.size + state.activeColors.size;
}

function installLink(pet) {
  const params = new URLSearchParams();
  if (pet.slug) params.set("slug", pet.slug);
  params.set("zipUrl", pet.zipUrl);
  return `petoverlay://petdex/install?${params.toString()}`;
}

function authorLabel(pet) {
  const name = pet.submittedByName || pet.submittedBy?.name;
  return name ? `by ${name}` : "";
}

function batchLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Class of ${date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
}

function accentForPet(pet) {
  const dominant = normalizeHex(pet.dominantColor);
  if (dominant) return dominant;
  const family = String(pet.colorFamily || "").toLowerCase();
  return FAMILY_DOT[family] || DEFAULT_ACCENT;
}

function normalizeHex(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || DEFAULT_ACCENT;
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))].sort();
}

function countValues(values) {
  return values.reduce((counts, value) => {
    if (!value) return counts;
    const key = String(value).trim();
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function compactCount(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function cssUrl(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
