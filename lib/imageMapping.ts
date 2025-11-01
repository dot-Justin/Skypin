import { BiomeType } from "./biomeDetector";

/**
 * Image counts for each biome and time-of-day combination.
 * Used to randomly select from available background images.
 *
 * File naming pattern: /images/{biome}/{biome}-{timeOfDay}-{number}.jpg
 * Example: /images/forest/forest-evening-3.jpg
 *
 * Note: Ocean and lake biomes currently fall back to beach images.
 * When ocean/lake images are added, create directories:
 * - public/images/ocean/
 * - public/images/lake/
 */
export const BIOME_IMAGE_COUNTS: Record<
  Exclude<BiomeType, "ocean" | "lake">,
  { day: number; evening: number; night: number }
> = {
  beach: {
    day: 5,
    evening: 7,
    night: 3,
  },
  city: {
    day: 5,
    evening: 12,
    night: 5,
  },
  desert: {
    day: 8,
    evening: 7,
    night: 10,
  },
  field: {
    day: 14,
    evening: 16,
    night: 0, // No night images available, will fallback to evening
  },
  forest: {
    day: 7,
    evening: 5,
    night: 2,
  },
};

/**
 * Fallback mapping for biomes without dedicated images
 */
export const BIOME_FALLBACKS: Partial<Record<BiomeType, Exclude<BiomeType, "ocean" | "lake">>> = {
  ocean: "beach",
  lake: "beach",
};
