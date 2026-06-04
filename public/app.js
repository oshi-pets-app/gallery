const PETDEX_COLUMNS = 8;
const PETDEX_ROWS = 9;
const IDLE_ROW = 0;
const IDLE_MIDDLE_FRAME = 3;
const FALLBACK_ACCENT = "#1E90FF";
const FAMILY_COLORS = {
  red: "#EF4444",
  orange: "#F59E0B",
  yellow: "#EAB308",
  lime: "#84CC16",
  green: "#22C55E",
  teal: "#14B8A6",
  blue: FALLBACK_ACCENT,
  indigo: "#6366F1",
  purple: "#A855F7",
  pink: "#EC4899",
  brown: "#A16207",
  neutral: "#A8A29E",
};

const state = {
  pets: [],
  filteredPets: [],
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  kindFilter: document.querySelector("#kindFilter"),
  vibeFilter: document.querySelector("#vibeFilter"),
  colorFilter: document.querySelector("#colorFilter"),
  clearButton: document.querySelector("#clearButton"),
  statusText: document.querySelector("#statusText"),
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
    populateFilters(state.pets);
    render();
  } catch (error) {
    elements.statusText.textContent = `Petdex snapshot could not load: ${error.message}`;
  }
}

function bindControls() {
  elements.searchInput.addEventListener("input", render);
  elements.sortSelect.addEventListener("change", render);
  elements.kindFilter.addEventListener("change", render);
  elements.vibeFilter.addEventListener("change", render);
  elements.colorFilter.addEventListener("change", render);
  elements.clearButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.kindFilter.value = "";
    elements.vibeFilter.value = "";
    elements.colorFilter.value = "";
    render();
  });
}

function populateFilters(pets) {
  fillSelect(elements.kindFilter, "All kinds", uniqueValues(pets.map((pet) => pet.kind)));
  fillSelect(elements.vibeFilter, "All vibes", uniqueValues(pets.flatMap((pet) => pet.vibes || [])));
  fillSelect(elements.colorFilter, "All colors", uniqueValues(pets.map((pet) => pet.colorFamily)));
}

function fillSelect(select, label, values) {
  select.innerHTML = "";
  select.append(new Option(label, ""));
  values.forEach((value) => select.append(new Option(value, value)));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))].sort();
}

function render() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const selectedKind = elements.kindFilter.value;
  const selectedVibe = elements.vibeFilter.value;
  const selectedColor = elements.colorFilter.value;
  const sort = elements.sortSelect.value;

  state.filteredPets = state.pets
    .filter((pet) => matchesQuery(pet, query))
    .filter((pet) => !selectedKind || pet.kind === selectedKind)
    .filter((pet) => !selectedVibe || (pet.vibes || []).includes(selectedVibe))
    .filter((pet) => !selectedColor || pet.colorFamily === selectedColor)
    .sort(sortPets(sort));

  elements.galleryGrid.innerHTML = "";
  state.filteredPets.forEach((pet, index) => {
    elements.galleryGrid.append(renderPetCard(pet, index));
  });
  elements.statusText.textContent = `${state.filteredPets.length} pets`;
}

function matchesQuery(pet, query) {
  if (!query) return true;
  const haystack = [
    pet.displayName,
    pet.slug,
    pet.description,
    pet.kind,
    ...(pet.vibes || []),
    ...(pet.tags || []),
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function sortPets(sort) {
  return (left, right) => {
    if (sort === "installed") return metric(right, "installCount") - metric(left, "installCount");
    if (sort === "popular") return metric(right, "likeCount") - metric(left, "likeCount");
    if (sort === "alpha") return String(left.displayName).localeCompare(String(right.displayName));
    return new Date(right.approvedAt || 0).getTime() - new Date(left.approvedAt || 0).getTime();
  };
}

function metric(pet, key) {
  return Number(pet?.metrics?.[key] ?? pet?.[key] ?? 0);
}

function renderPetCard(pet, index) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const accent = accentForPet(pet);
  card.style.setProperty("--blue", accent);
  card.querySelector(".card-accent").style.background = accent;
  card.querySelector(".sprite-stage").style.background = `linear-gradient(135deg, ${withAlpha(accent, 0.34)}, #1b2745 48%, #14202e)`;
  card.querySelector(".dex-number").textContent = `No. ${String(index + 1).padStart(3, "0")}`;
  card.querySelector(".installs").textContent = `${compactCount(metric(pet, "installCount"))} installs`;
  card.querySelector("h2").textContent = pet.displayName || pet.slug || "Pet";
  card.querySelector(".kind").textContent = pet.kind || "";
  card.querySelector(".description").textContent = pet.description || "";
  card.querySelector(".batch").textContent = batchLabel(pet.approvedAt);
  card.querySelector(".author").textContent = pet.submittedByName ? `by ${pet.submittedByName}` : "";
  card.querySelector(".metrics").textContent = `${metric(pet, "installCount")} installs  ${metric(pet, "likeCount")} likes`;
  if (pet.featured) card.classList.add("featured");

  const tags = card.querySelector(".tags");
  [...new Set([...(pet.vibes || []), ...(pet.tags || [])])].slice(0, 4).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = `#${tag}`;
    tags.append(chip);
  });

  drawSpritePreview(card.querySelector("canvas"), pet.spritesheetUrl || pet.spritesheetPath);

  const installButton = card.querySelector(".install-button");
  const hint = card.querySelector(".install-hint");
  if (!pet.zipUrl) {
    installButton.disabled = true;
    hint.textContent = "No ZIP package is available for this pet.";
  } else {
    installButton.addEventListener("click", () => {
      const link = installLink(pet);
      hint.textContent = "Opening Pet Overlay app…";
      window.location.href = link;
      window.setTimeout(() => {
        hint.textContent = "If the app did not open, install Pet Overlay first.";
      }, 1400);
    });
  }

  return card;
}

function drawSpritePreview(canvas, spritesheetUrl) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!spritesheetUrl) return;
  const image = new Image();
  image.onload = () => {
    const frameWidth = Math.floor(image.width / PETDEX_COLUMNS);
    const frameHeight = Math.floor(image.height / PETDEX_ROWS);
    if (frameWidth <= 0 || frameHeight <= 0) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      IDLE_MIDDLE_FRAME * frameWidth,
      IDLE_ROW * frameHeight,
      frameWidth,
      frameHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };
  image.onerror = () => {
    context.fillStyle = "#a7a8b2";
    context.font = "24px system-ui";
    context.fillText("?", 74, 88);
  };
  image.src = spritesheetUrl;
}

function installLink(pet) {
  const params = new URLSearchParams();
  if (pet.slug) params.set("slug", pet.slug);
  params.set("zipUrl", pet.zipUrl);
  return `petoverlay://petdex/install?${params.toString()}`;
}

function accentForPet(pet) {
  const dominant = normalizeHex(pet.dominantColor);
  if (dominant) return dominant;
  return FAMILY_COLORS[String(pet.colorFamily || "").toLowerCase()] || FALLBACK_ACCENT;
}

function normalizeHex(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized) ? normalized : null;
}

function withAlpha(hex, alpha) {
  const normalized = normalizeHex(hex) || FALLBACK_ACCENT;
  const value = normalized.slice(1, 7);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function batchLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Class of ${date.toLocaleString("en-US", { month: "long" })} ${date.getUTCFullYear()}`;
}

function compactCount(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}
