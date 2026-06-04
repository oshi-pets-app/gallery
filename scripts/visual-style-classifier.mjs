import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

export const VISUAL_STYLE_CLASSIFIER_VERSION = "pixel-art-heuristic-v4";

const DEFAULT_CONCURRENCY = Number(process.env.PETDEX_CLASSIFIER_CONCURRENCY || 8);
const MAX_IMAGE_BYTES = Number(process.env.PETDEX_CLASSIFIER_MAX_IMAGE_BYTES || 25 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.PETDEX_CLASSIFIER_TIMEOUT_MS || 20000);
const PETDEX_ORIGIN = "https://petdex.crafter.run";

export async function classifyPetVisualStyles(pets, { cachePath, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const cache = await readCache(cachePath);
  const entries = cache.entries || {};
  const queue = pets.filter((pet) => needsClassification(pet, entries[pet.slug]));

  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (nextIndex < queue.length) {
      const pet = queue[nextIndex++];
      entries[pet.slug] = await classifyPet(pet);
    }
  });
  await Promise.all(workers);

  const counts = countStyles(Object.values(entries));
  const nextCache = {
    generatedAt: new Date().toISOString(),
    classifier: {
      name: "Petdex sprite visual style heuristic",
      version: VISUAL_STYLE_CLASSIFIER_VERSION,
      references: [
        {
          name: "rmtd418/Pixel-Grid-Inspector-",
          url: "https://github.com/rmtd418/Pixel-Grid-Inspector-",
          note: "Reviewed for pixel-grid detection concepts; no code copied.",
        },
        {
          name: "kovendhan5/intel-project",
          url: "https://github.com/kovendhan5/intel-project",
          note: "Reviewed as an MIT ML-based pixelated-image classifier; not used because it requires a trained model.",
        },
      ],
    },
    counts,
    entries,
  };

  for (const pet of pets) {
    const entry = entries[pet.slug];
    if (entry && !entry.sourceImageKey) entry.sourceImageKey = classificationImageUrls(pet).join("|");
  }

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`, "utf8");

  return pets.map((pet) => {
    const entry = entries[pet.slug];
    return {
      ...pet,
      visualStyle: entry?.visualStyle || "other",
      visualStyleConfidence: Number(entry?.confidence || 0),
    };
  });
}

async function readCache(cachePath) {
  if (!cachePath) return { entries: {} };
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return { entries: {} };
    throw error;
  }
}

function needsClassification(pet, entry) {
  const imageUrls = classificationImageUrls(pet);
  const imageKey = imageUrls.join("|");
  return !entry ||
    entry.classifierVersion !== VISUAL_STYLE_CLASSIFIER_VERSION ||
    entry.spritesheetUrl !== pet.spritesheetUrl ||
    (entry.sourceImageKey || (imageUrls.includes(entry.sourceImageUrl) ? imageKey : "")) !== imageKey ||
    !["pixel_art", "other"].includes(entry.visualStyle);
}

async function classifyPet(pet) {
  const classifiedAt = new Date().toISOString();
  const sourceImageUrls = classificationImageUrls(pet);
  let sourceImageUrl = sourceImageUrls[0] || "";
  try {
    const downloaded = await downloadFirstAvailableImage(sourceImageUrls);
    sourceImageUrl = downloaded.url;
    const buffer = downloaded.buffer;
    const result = await classifyImageBuffer(buffer);
    return {
      spritesheetUrl: pet.spritesheetUrl,
      sourceImageKey: sourceImageUrls.join("|"),
      sourceImageUrl,
      visualStyle: result.visualStyle,
      confidence: result.confidence,
      classifiedAt,
      classifierVersion: VISUAL_STYLE_CLASSIFIER_VERSION,
    };
  } catch (error) {
    return {
      spritesheetUrl: pet.spritesheetUrl || "",
      sourceImageKey: sourceImageUrls.join("|"),
      sourceImageUrl,
      visualStyle: "other",
      confidence: 0,
      classifiedAt,
      classifierVersion: VISUAL_STYLE_CLASSIFIER_VERSION,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadFirstAvailableImage(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      return { url, buffer: await downloadImage(url) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join("; ") || "no image URL available");
}

function classificationImageUrls(pet) {
  if (!pet.slug) return pet.spritesheetUrl ? [pet.spritesheetUrl] : [];
  const slug = encodeURIComponent(pet.slug);
  return [
    `${PETDEX_ORIGIN}/api/pets/${slug}/sticker`,
    `${PETDEX_ORIGIN}/api/pets/${slug}/thumb`,
  ];
}

async function downloadImage(url) {
  if (!url) throw new Error("missing spritesheet URL");
  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/*,*/*",
      "User-Agent": "PetOverlayCompose-PixelArtClassifier",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`spritesheet request failed with HTTP ${response.status}`);

  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_IMAGE_BYTES) throw new Error(`spritesheet exceeds ${MAX_IMAGE_BYTES} bytes`);

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`spritesheet exceeds ${MAX_IMAGE_BYTES} bytes`);
  return Buffer.from(arrayBuffer);
}

async function classifyImageBuffer(buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: 20_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("spritesheet dimensions are unavailable");
  if (metadata.width < 8 || metadata.height < 8) throw new Error("image is too small to classify");

  const { data, info } = await sharp(buffer, { limitInputPixels: 20_000_000 })
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .resize({ width: 192, height: 192, fit: "inside", kernel: "nearest", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const analysis = analyzeFrame(data, info.width, info.height, info.channels);
  const confidence = Math.max(0, Math.min(1, analysis.score));
  return {
    visualStyle: confidence >= 0.5 ? "pixel_art" : "other",
    confidence: Number(confidence.toFixed(3)),
  };
}

function analyzeFrame(data, width, height, channels) {
  const quantizedColors = new Set();
  const exactColors = new Set();
  let opaquePixels = 0;
  let comparableEdges = 0;
  let sameEdges = 0;
  let softEdges = 0;
  let hardEdges = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] < 32) continue;

      opaquePixels += 1;
      exactColors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
      quantizedColors.add(`${data[offset] >> 3},${data[offset + 1] >> 3},${data[offset + 2] >> 3}`);

      if (x + 1 < width) {
        const right = offset + channels;
        if (data[right + 3] >= 32) {
          const distance = colorDistance(data, offset, right);
          comparableEdges += 1;
          if (distance <= 4) sameEdges += 1;
          else if (distance <= 35) softEdges += 1;
          else hardEdges += 1;
        }
      }
      if (y + 1 < height) {
        const down = offset + width * channels;
        if (data[down + 3] >= 32) {
          const distance = colorDistance(data, offset, down);
          comparableEdges += 1;
          if (distance <= 4) sameEdges += 1;
          else if (distance <= 35) softEdges += 1;
          else hardEdges += 1;
        }
      }
    }
  }

  if (opaquePixels < 100 || comparableEdges < 100) return { score: 0 };

  const sameRate = sameEdges / comparableEdges;
  const softRate = softEdges / comparableEdges;
  const hardRate = hardEdges / comparableEdges;
  const exactPaletteScore = 1 - Math.min(1, exactColors.size / 450);
  const quantizedPaletteScore = 1 - Math.min(1, quantizedColors.size / 160);
  const lowSoftEdgeScore = 1 - Math.min(1, softRate / 0.22);
  const hardVsSoftScore = hardEdges / Math.max(1, hardEdges + softEdges);

  return {
    score:
      sameRate * 0.28 +
      hardRate * 0.18 +
      exactPaletteScore * 0.18 +
      quantizedPaletteScore * 0.18 +
      lowSoftEdgeScore * 0.1 +
      hardVsSoftScore * 0.08,
  };
}

function colorDistance(data, left, right) {
  return (
    Math.abs(data[left] - data[right]) +
    Math.abs(data[left + 1] - data[right + 1]) +
    Math.abs(data[left + 2] - data[right + 2])
  );
}

function countStyles(entries) {
  return entries.reduce(
    (counts, entry) => {
      if (entry.visualStyle === "pixel_art") counts.pixel_art += 1;
      else counts.other += 1;
      return counts;
    },
    { pixel_art: 0, other: 0 },
  );
}
