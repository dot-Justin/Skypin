import { BiomeType } from "./biomeDetector";
import { BIOME_IMAGE_COUNTS, BIOME_FALLBACKS } from "./imageMapping";

export type TimeOfDay = "day" | "evening" | "night";

/**
 * Simple hash function for string input.
 * Converts a string to a stable numeric hash value.
 * 
 * @param str - String to hash
 * @returns 32-bit integer hash
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded pseudo-random number generator (LCG algorithm).
 * Produces deterministic "random" numbers from a seed.
 * 
 * @param seed - Integer seed value
 * @returns Pseudo-random float between 0 and 1
 */
function seededRandom(seed: number): number {
  // Linear Congruential Generator constants (same as glibc)
  const a = 1103515245;
  const c = 12345;
  const m = 2 ** 31;
  
  const next = (a * seed + c) % m;
  return next / m;
}

/**
 * Extracts time of day from ISO timestamp.
 *
 * Time periods:
 * - Day: 6:00 - 17:59 (6am - 5:59pm)
 * - Evening: 18:00 - 21:59 (6pm - 9:59pm)
 * - Night: 22:00 - 5:59 (10pm - 5:59am)
 *
 * @param localtime - ISO 8601 timestamp (e.g., "2025-10-31T14:30:00")
 * @returns Time of day classification
 *
 * @example
 * getTimeOfDay("2025-10-31T14:30:00") // "day"
 * getTimeOfDay("2025-10-31T19:45:00") // "evening"
 * getTimeOfDay("2025-10-31T23:00:00") // "night"
 */
export function getTimeOfDay(localtime: string): TimeOfDay {
  const date = new Date(localtime);
  const hour = date.getHours();

  if (hour >= 6 && hour < 18) {
    return "day";
  } else if (hour >= 18 && hour < 22) {
    return "evening";
  } else {
    return "night";
  }
}

/**
 * Gets the effective biome for image selection, handling fallbacks.
 *
 * @param biome - Original biome type from detector
 * @returns Biome type to use for image selection
 */
function getEffectiveBiome(biome: BiomeType): Exclude<BiomeType, "ocean" | "lake"> {
  // Check if this biome needs a fallback
  if (biome === "ocean" || biome === "lake") {
    return BIOME_FALLBACKS[biome] || "beach";
  }
  return biome as Exclude<BiomeType, "ocean" | "lake">;
}

/**
 * Gets the effective time of day for image selection, handling missing images.
 *
 * @param biome - Effective biome (after fallback resolution)
 * @param timeOfDay - Requested time of day
 * @returns Time of day to use for image selection
 */
function getEffectiveTimeOfDay(
  biome: Exclude<BiomeType, "ocean" | "lake">,
  timeOfDay: TimeOfDay
): TimeOfDay {
  const counts = BIOME_IMAGE_COUNTS[biome];

  // If requested time has no images, fall back to evening, then day
  if (counts[timeOfDay] === 0) {
    if (counts.evening > 0) {
      return "evening";
    }
    return "day";
  }

  return timeOfDay;
}

/**
 * Gets available image paths for a specific biome and time of day.
 *
 * @param biome - Biome type
 * @param timeOfDay - Time of day
 * @returns Array of image paths
 *
 * @example
 * getAvailableImages("forest", "evening")
 * // Returns: [
 * //   "/images/forest/forest-evening-1.jpg",
 * //   "/images/forest/forest-evening-2.jpg",
 * //   ...
 * // ]
 */
export function getAvailableImages(biome: BiomeType, timeOfDay: TimeOfDay): string[] {
  const effectiveBiome = getEffectiveBiome(biome);
  const effectiveTime = getEffectiveTimeOfDay(effectiveBiome, timeOfDay);

  const count = BIOME_IMAGE_COUNTS[effectiveBiome][effectiveTime];
  const images: string[] = [];

  for (let i = 1; i <= count; i++) {
    images.push(`/images/${effectiveBiome}/${effectiveBiome}-${effectiveTime}-${i}.jpg`);
  }

  return images;
}

/**
 * Gets a deterministic background image path for a biome, time of day, and location.
 * 
 * Uses location coordinates + biome + time to create a stable seed, ensuring:
 * - Same location + same conditions = same image every time
 * - Different locations = different images (variety maintained)
 * 
 * @param biome - Biome type from detector
 * @param timeOfDay - Time of day classification
 * @param lat - Latitude (optional, for deterministic selection)
 * @param lon - Longitude (optional, for deterministic selection)
 * @returns Deterministic image path
 *
 * @example
 * getBiomeImagePath("forest", "evening", 40.7128, -74.0060)
 * // Returns: "/images/forest/forest-evening-3.jpg" (always the same for NYC)
 *
 * getBiomeImagePath("ocean", "day")
 * // Returns: "/images/beach/beach-day-2.jpg" (fallback to beach)
 */
export function getBiomeImagePath(
  biome: BiomeType, 
  timeOfDay: TimeOfDay,
  lat?: number,
  lon?: number
): string {
  const availableImages = getAvailableImages(biome, timeOfDay);

  // If no location provided, fall back to first image (stable default)
  if (lat === undefined || lon === undefined) {
    return availableImages[0];
  }

  // Create deterministic seed from location + biome + time
  // Round coordinates to 2 decimal places (~1km precision) for stability
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const seedString = `${roundedLat},${roundedLon},${biome},${timeOfDay}`;
  
  // Generate hash and use seeded random to select image
  const hash = simpleHash(seedString);
  const pseudoRandom = seededRandom(hash);
  const index = Math.floor(pseudoRandom * availableImages.length);
  
  return availableImages[index];
}

/**
 * Formats biome name for display.
 *
 * @param biome - Biome type
 * @returns Formatted display name
 *
 * @example
 * formatBiomeForDisplay("forest") // "Forest"
 * formatBiomeForDisplay("city") // "City"
 */
export function formatBiomeForDisplay(biome: BiomeType): string {
  return biome.charAt(0).toUpperCase() + biome.slice(1);
}
