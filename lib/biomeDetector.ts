import biomeGrid from "./data/biomes.json";

export type BiomeType = "ocean" | "beach" | "desert" | "field" | "forest" | "city";

const GRID_RESOLUTION = 1.0; // Must match preprocessing script

/**
 * Detects the biome for given coordinates using pre-computed grid data.
 *
 * @param lat - Latitude (-90 to 90)
 * @param lon - Longitude (-180 to 180)
 * @returns Biome type: "ocean", "beach", "desert", "field", "forest", or "city"
 *
 * Note: This function only detects natural biomes. City detection must be done
 * separately using Open-Meteo's feature_code at runtime.
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

  return {
    inputCoords: { lat, lon },
    gridCoords: { lat: gridLat, lon: gridLon },
    gridKey: key,
    biome,
    distance: Math.sqrt(
      Math.pow((lat - gridLat) * 111, 2) +
      Math.pow((lon - gridLon) * 111 * Math.cos(lat * Math.PI / 180), 2)
    ).toFixed(1) + " km"
  };
}
