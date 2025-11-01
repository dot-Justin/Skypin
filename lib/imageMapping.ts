import type { BiomeType } from "./biomeDetector";
import countsJson from "./data/biomeImageCounts.json";

type TimeSlot = "day" | "evening" | "night";

type BiomeImageCounts = Record<BiomeType, Record<TimeSlot, number>>;

const BIOME_TYPES: BiomeType[] = ["ocean", "lake", "beach", "desert", "field", "forest", "city"];
const EMPTY_COUNTS: Record<TimeSlot, number> = { day: 0, evening: 0, night: 0 };

const normalizedCounts = BIOME_TYPES.reduce<BiomeImageCounts>((acc, biome) => {
  const counts =
    (countsJson as Record<string, Partial<Record<TimeSlot, number>>>)[biome] ?? EMPTY_COUNTS;

  acc[biome] = {
    day: counts.day ?? 0,
    evening: counts.evening ?? 0,
    night: counts.night ?? 0,
  };

  return acc;
}, {} as BiomeImageCounts);

/**
 * Image counts for each biome and time-of-day combination.
 * Used to randomly select from available background images.
 *
 * File naming pattern: /images/{biome}/{biome}-{timeOfDay}-{number}.jpg
 * Example: /images/forest/forest-evening-3.jpg
 */
export const BIOME_IMAGE_COUNTS = normalizedCounts;

/**
 * Fallback mapping for biomes without dedicated images
 */
export const BIOME_FALLBACKS: Partial<Record<BiomeType, BiomeType>> = {
  ocean: "beach",
  lake: "beach",
};
