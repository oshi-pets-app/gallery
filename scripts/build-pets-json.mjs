import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputPath = resolve(repoRoot, "public", "pets.json");
const apiUrl = "https://petdex.crafter.run/api/pets/search";
const limit = Number(process.env.PETDEX_GALLERY_LIMIT || 48);
const maxPages = Number(process.env.PETDEX_GALLERY_MAX_PAGES || 3);

const petsBySlug = new Map();
let cursor = 0;
let total = 0;
let facets = { kinds: {}, vibes: {}, colors: {} };

for (let page = 0; page < maxPages; page += 1) {
  const url = new URL(apiUrl);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("limit", String(limit));
  if (cursor > 0) url.searchParams.set("cursor", String(cursor));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PetOverlayCompose-GitHubPagesSnapshot",
    },
  });
  if (!response.ok) {
    throw new Error(`Petdex snapshot request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  total = Number(payload.total || total || 0);
  facets = payload.facets || facets;
  for (const pet of payload.pets || []) {
    if (!pet.slug || petsBySlug.has(pet.slug)) continue;
    petsBySlug.set(pet.slug, normalizePet(pet));
  }
  if (!payload.nextCursor) break;
  cursor = Number(payload.nextCursor);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: `${apiUrl}?sort=recent&limit=${limit}`,
  total,
  pets: [...petsBySlug.values()],
  facets,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${snapshot.pets.length} Petdex pets to ${outputPath}`);

function normalizePet(pet) {
  const metrics = pet.metrics || {};
  return {
    slug: pet.slug || "",
    displayName: pet.displayName || pet.slug || "Pet",
    description: pet.description || "",
    spritesheetUrl: pet.spritesheetPath || pet.spritesheetUrl || "",
    petJsonUrl: pet.petJsonPath || pet.petJsonUrl || "",
    zipUrl: pet.zipUrl || null,
    kind: pet.kind || "",
    vibes: arrayOfStrings(pet.vibes),
    tags: arrayOfStrings(pet.tags),
    colorFamily: pet.colorFamily || null,
    dominantColor: pet.dominantColor || null,
    submittedByName: pet.submittedBy?.name || null,
    approvedAt: pet.approvedAt || null,
    featured: Boolean(pet.featured),
    source: pet.source || null,
    metrics: {
      installCount: Number(metrics.installCount || 0),
      likeCount: Number(metrics.likeCount || 0),
      zipDownloadCount: Number(metrics.zipDownloadCount || 0),
    },
  };
}

function arrayOfStrings(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}
