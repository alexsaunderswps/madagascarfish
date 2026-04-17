#!/usr/bin/env node
/**
 * Pre-bake ESRI World Imagery tiles for Madagascar bbox at z5–9 into
 * frontend/public/tiles/{z}/{x}/{y}.png. Used as a local fallback when ESRI
 * is throttled, offline, or venue Wi-Fi drops during the ECA workshop demo.
 *
 * Source: https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
 * Note ESRI's path order is z/y/x; we persist as z/x/y to match Leaflet {z}/{x}/{y}.
 *
 * Usage: node frontend/scripts/bake-esri-tiles.mjs
 *
 * Re-running is idempotent: tiles already on disk are skipped. Delete the
 * frontend/public/tiles/ directory to force a full rebake.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "tiles");

// Madagascar bbox with a small halo for comfortable pan.
const BBOX = {
  north: -11.0,
  south: -26.5,
  west: 42.5,
  east: 51.5,
};

const ZOOMS = [5, 6, 7, 8, 9];
const CONCURRENCY = 6;
const RETRIES = 3;
const BASE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

function lngToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
}

function tileRange(z) {
  const xMin = lngToTileX(BBOX.west, z);
  const xMax = lngToTileX(BBOX.east, z);
  // Latitude: north is smaller y in XYZ
  const yMin = latToTileY(BBOX.north, z);
  const yMax = latToTileY(BBOX.south, z);
  return { xMin, xMax, yMin, yMax };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchTile(z, x, y) {
  const url = `${BASE_URL}/${z}/${y}/${x}`;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "MadagascarFreshwaterFishConservationPlatform/tile-baker (conservation use)",
          Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function bakeOne(z, x, y, stats) {
  const outPath = join(OUT_DIR, String(z), String(x), `${y}.png`);
  if (await exists(outPath)) {
    stats.skipped++;
    return;
  }
  const buf = await fetchTile(z, x, y);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  stats.fetched++;
  stats.bytes += buf.length;
}

async function runPool(tasks, limit) {
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < tasks.length) {
      const task = tasks[i++];
      await task();
    }
  });
  await Promise.all(workers);
}

async function main() {
  const stats = { fetched: 0, skipped: 0, bytes: 0 };
  const plan = [];

  for (const z of ZOOMS) {
    const { xMin, xMax, yMin, yMax } = tileRange(z);
    const count = (xMax - xMin + 1) * (yMax - yMin + 1);
    console.log(
      `z=${z}: x=[${xMin}..${xMax}] y=[${yMin}..${yMax}] (${count} tiles)`,
    );
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        plan.push(() => bakeOne(z, x, y, stats));
      }
    }
  }

  console.log(`Total planned: ${plan.length} tiles. Starting…`);
  const started = Date.now();
  await runPool(plan, CONCURRENCY);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `Done in ${elapsed}s — fetched=${stats.fetched} skipped=${stats.skipped} ` +
      `bytes=${(stats.bytes / 1024 / 1024).toFixed(2)}MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
