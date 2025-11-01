import { promises as fs } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { BiomeType } from "../lib/biomeDetector";

type TimeSlot = "day" | "evening" | "night";

const BIOME_TYPES: BiomeType[] = [
  "ocean",
  "lake",
  "beach",
  "desert",
  "field",
  "forest",
  "city",
];

const TIME_SLOTS: TimeSlot[] = ["day", "evening", "night"];

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const imagesRoot = join(projectRoot, "public", "images", "backgrounds");
const outputPath = join(projectRoot, "lib", "data", "biomeImageCounts.json");

async function ensureDirectory(path: string) {
  await fs.mkdir(path, { recursive: true });
}

async function getImageCountsForBiome(biome: BiomeType) {
  const biomeDir = join(imagesRoot, biome);
  const counts: Record<TimeSlot, number> = {
    day: 0,
    evening: 0,
    night: 0,
  };

  try {
    const entries = await fs.readdir(biomeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(
        new RegExp(`^${biome}-(day|evening|night)-\\d+\\.(jpg|jpeg|png|webp)$`, "i"),
      );

      if (!match) continue;

      const slot = match[1].toLowerCase() as TimeSlot;
      counts[slot] += 1;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    // Missing directory is treated as zero counts.
  }

  return counts;
}

async function generateImageCounts() {
  const result: Record<BiomeType, Record<TimeSlot, number>> = {} as Record<
    BiomeType,
    Record<TimeSlot, number>
  >;

  for (const biome of BIOME_TYPES) {
    result[biome] = await getImageCountsForBiome(biome);
  }

  await ensureDirectory(join(projectRoot, "lib", "data"));
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const relativePath = relative(projectRoot, outputPath);
  console.log(`Biome image counts written to ${relativePath}`);
}

generateImageCounts().catch((error) => {
  console.error("Failed to generate biome image counts:", error);
  process.exit(1);
});
