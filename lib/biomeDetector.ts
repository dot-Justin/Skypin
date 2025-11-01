import biomeGrid from "./data/biomes.json";

export type BiomeType = "ocean" | "lake" | "beach" | "desert" | "field" | "forest" | "city";

const GRID_RESOLUTION = 1.0; // Must match preprocessing script

/**
 * Buffer radii (in degrees) for expanding each biome type.
 * Allows biomes to extend their influence beyond their exact grid cell.
 * 0 = no expansion, 1.0 = include neighboring cells (approximately 111km at equator)
 */
export const BIOME_BUFFERS: Partial<Record<BiomeType, number>> = {
  forest: 0.5,   // Expand forests by ~55km
  ocean: 0,      // Ocean doesn't expand
  lake: 0.2,     // Expand lakes slightly
  beach: 0.3,    // Expand beaches slightly
  desert: 0.3,   // Expand deserts slightly
  field: 0.1,    // Minimal field expansion
  city: 0.2      // Expand cities slightly
};

/**
 * Detects the biome for given coordinates using pre-computed grid data.
 *
 * @param lat - Latitude (-90 to 90)
 * @param lon - Longitude (-180 to 180)
 * @returns Biome type: "ocean", "lake", "beach", "desert", "field", "forest", or "city"
 *
 * Note: City detection is based on MODIS land cover classification (≥30% impervious surface).
 * For enhanced accuracy, use getBiomeWithCity() to overlay Open-Meteo's feature_code data.
 */
export function getBiome(lat: number, lon: number): BiomeType {
  // Clamp coordinates to valid range
  lat = Math.max(-90, Math.min(90, lat));
  lon = Math.max(-180, Math.min(180, lon));

  // Round to nearest grid cell
  const gridLat = Math.round(lat / GRID_RESOLUTION) * GRID_RESOLUTION;
  const gridLon = Math.round(lon / GRID_RESOLUTION) * GRID_RESOLUTION;

  // Create lookup key
  const key = `${gridLat.toFixed(1)}_${gridLon.toFixed(1)}`;

  // Lookup in grid (type assertion needed because JSON import)
  const biome = (biomeGrid as Record<string, BiomeType>)[key];

  // Fallback to ocean if not found (shouldn't happen with complete grid)
  return biome || "ocean";
}

/**
 * Detects biome with city override based on Open-Meteo location data.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @param featureCode - Optional Open-Meteo feature_code (e.g., "PPLA", "PPLC")
 * @returns Biome type with city detection
 *
 * @example
 * // Without city detection
 * const biome = getBiomeWithCity(40.7128, -74.0060);
 * // With Open-Meteo data
 * const biome = getBiomeWithCity(40.7128, -74.0060, "PPLA");
 */
export function getBiomeWithCity(
  lat: number,
  lon: number,
  featureCode?: string
): BiomeType {
  // Check if this is a populated place
  if (featureCode && featureCode.startsWith("PPL")) {
    return "city";
  }

  // Otherwise use grid lookup
  return getBiome(lat, lon);
}

/**
 * Detects biome with buffer expansion applied.
 * Checks nearby grid cells within the specified buffer radius to find matching biomes.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @param bufferRadiusDegrees - Search radius in degrees (e.g., 0.5 for ~55km)
 * @param preferredBiome - Optional biome type to expand/prefer
 * @returns Biome type from grid or nearby cells
 *
 * @example
 * // Expand forests up to 0.5 degrees (~55km)
 * const biome = getBiomeWithBuffer(40.7128, -74.0060, 0.5);
 *
 * @example
 * // Only expand if we're looking for forests specifically
 * const biome = getBiomeWithBuffer(40.7128, -74.0060, 0.5, 'forest');
 */
export function getBiomeWithBuffer(
  lat: number,
  lon: number,
  bufferRadiusDegrees: number = 0,
  preferredBiome?: BiomeType
): BiomeType {
  // Clamp coordinates to valid range
  lat = Math.max(-90, Math.min(90, lat));
  lon = Math.max(-180, Math.min(180, lon));

  // First try exact lookup
  const exactBiome = getBiome(lat, lon);

  // If no buffer or already found preferred biome, return exact
  if (bufferRadiusDegrees === 0 || (preferredBiome && exactBiome === preferredBiome)) {
    return exactBiome;
  }

  // Search nearby cells within buffer radius
  const gridLat = Math.round(lat / GRID_RESOLUTION) * GRID_RESOLUTION;
  const gridLon = Math.round(lon / GRID_RESOLUTION) * GRID_RESOLUTION;

  const bufferSteps = Math.ceil(bufferRadiusDegrees / GRID_RESOLUTION);
  const biomeCount: Record<string, number> = {};
  let foundPreferred = false;

  for (let dLat = -bufferSteps; dLat <= bufferSteps; dLat++) {
    for (let dLon = -bufferSteps; dLon <= bufferSteps; dLon++) {
      const checkLat = gridLat + dLat * GRID_RESOLUTION;
      const checkLon = gridLon + dLon * GRID_RESOLUTION;

      // Skip cells outside valid range
      if (checkLat < -90 || checkLat > 90 || checkLon < -180 || checkLon > 180) {
        continue;
      }

      const cellBiome = getBiome(checkLat, checkLon);

      // If we found the preferred biome, return immediately
      if (preferredBiome && cellBiome === preferredBiome) {
        foundPreferred = true;
        break;
      }

      biomeCount[cellBiome] = (biomeCount[cellBiome] || 0) + 1;
    }
    if (foundPreferred) break;
  }

  if (foundPreferred) {
    return preferredBiome!;
  }

  // Return most common biome in buffer (or exact if none found)
  const mostCommon = Object.entries(biomeCount).sort(([, a], [, b]) => b - a)[0];
  return (mostCommon?.[0] as BiomeType) || exactBiome;
}

/**
 * Get biome information with debugging details.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Object with biome and grid coordinates
 */
export function getBiomeDebug(lat: number, lon: number) {
  const gridLat = Math.round(lat / GRID_RESOLUTION) * GRID_RESOLUTION;
  const gridLon = Math.round(lon / GRID_RESOLUTION) * GRID_RESOLUTION;
  const key = `${gridLat.toFixed(1)}_${gridLon.toFixed(1)}`;
  const biome = getBiome(lat, lon);
  const biomeWithBuffer = getBiomeWithBuffer(lat, lon, 0.5);

  return {
    inputCoords: { lat, lon },
    gridCoords: { lat: gridLat, lon: gridLon },
    gridKey: key,
    biome,
    biomeWithBuffer,
    distance: Math.sqrt(
      Math.pow((lat - gridLat) * 111, 2) +
      Math.pow((lon - gridLon) * 111 * Math.cos(lat * Math.PI / 180), 2)
    ).toFixed(1) + " km"
  };
}
