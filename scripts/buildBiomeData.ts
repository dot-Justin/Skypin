import * as fs from "fs";
import * as path from "path";
import { fromFile } from "geotiff";
import * as shapefile from "shapefile";
import * as turf from "@turf/turf";
import { Feature } from "geojson";
import RBush from "rbush";
import bbox from "@turf/bbox";

type BiomeType = "ocean" | "lake" | "beach" | "desert" | "field" | "forest" | "city";

interface BiomeGrid {
  [key: string]: BiomeType;
}

interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  feature: Feature;
}

const GRID_RESOLUTION = 0.5; // degrees (~111km at equator)

// ============================================================================
// Unified Distance-Based Buffer System (Single Phase)
// ============================================================================
// All biome buffers are defined in kilometers and applied during grid
// generation using Turf.js distance calculations. These values represent
// how far from detected raster/shapefile features the biome extends outward.
//
// Conversion reference (1 grid cell = 1° ≈ 111 km at equator):
const BIOME_BUFFERS: Record<BiomeType, number> = {
  ocean: 0,      // Ocean: 0 km (water-to-land boundaries remain sharp)
  lake: 10,     // Lake/inland water: 111 km expansion (1 cell)
  beach: 10,    // Beach/coastal: 222 km expansion (2 cells)
  desert: 10,   // Desert: 222 km expansion (2 cells)
  field: 0,      // Field: 0 km (baseline, acts as neutral filler)
  forest: 10,   // Forest: 222 km expansion (2 cells - large influence zone)
  city: 10,     // City: 333 km expansion (3 cells - urban zones extend far)
};

// Search radius for spatial index queries (degrees)
// Must be >= largest buffer distance converted to degrees (333km ≈ 3 degrees)
const SPATIAL_SEARCH_RADIUS_DEGREES = 3.0;

// MODIS Land Cover (IGBP) classification to biome mapping
const MODIS_TO_BIOME: Record<number, BiomeType> = {
  0: "ocean",   // Water Bodies
  1: "forest",  // Evergreen Needleleaf Forests
  2: "forest",  // Evergreen Broadleaf Forests
  3: "forest",  // Deciduous Needleleaf Forests
  4: "forest",  // Deciduous Broadleaf Forests
  5: "forest",  // Mixed Forests
  6: "field",   // Closed Shrublands
  7: "field",   // Open Shrublands
  8: "forest",  // Woody Savannas (significant tree cover)
  9: "field",   // Savannas
  10: "field",  // Grasslands
  11: "lake",   // Permanent Wetlands
  12: "field",  // Croplands
  13: "city",   // Urban and Built-up Lands (≥30% impervious surface)
  14: "field",  // Cropland/Natural Vegetation Mosaics
  15: "field",  // Permanent Snow and Ice
  16: "desert", // Barren
};

// Köppen-Geiger classification to biome mapping (fallback)
const KOPPEN_TO_BIOME: Record<number, BiomeType> = {
  // Tropical (A) - Rainforest
  1: "forest",  // Af - Tropical rainforest
  2: "forest",  // Am - Tropical monsoon
  3: "forest",  // Aw - Tropical savanna (wet)

  // Arid (B) - Desert/Steppe
  4: "desert",  // BWh - Hot desert
  5: "desert",  // BWk - Cold desert
  6: "desert",  // BSh - Hot semi-arid
  7: "desert",  // BSk - Cold semi-arid

  // Temperate (C)
  8: "field",   // Csa - Mediterranean hot summer
  9: "field",   // Csb - Mediterranean warm summer
  10: "field",  // Csc - Mediterranean cold summer
  11: "forest", // Cfa - Humid subtropical
  12: "forest", // Cfb - Oceanic
  13: "forest", // Cfc - Subpolar oceanic
  14: "field",  // Cwa - Monsoon-influenced humid subtropical
  15: "field",  // Cwb - Subtropical highland
  16: "field",  // Cwc - Cold subtropical highland

  // Continental (D)
  17: "field",  // Dsa - Mediterranean-influenced hot summer continental
  18: "field",  // Dsb - Mediterranean-influenced warm summer continental
  19: "field",  // Dsc - Mediterranean-influenced subarctic
  20: "field",  // Dsd - Mediterranean-influenced extremely cold subarctic
  21: "forest", // Dfa - Hot summer humid continental
  22: "forest", // Dfb - Warm summer humid continental
  23: "forest", // Dfc - Subarctic
  24: "forest", // Dfd - Extremely cold subarctic
  25: "field",  // Dwa - Monsoon-influenced hot summer continental
  26: "field",  // Dwb - Monsoon-influenced warm summer continental
  27: "field",  // Dwc - Monsoon-influenced subarctic
  28: "field",  // Dwd - Monsoon-influenced extremely cold subarctic

  // Polar (E)
  29: "field",  // ET - Tundra
  30: "field",  // EF - Ice cap

  // Ocean/No data
  0: "ocean",   // No data
};

async function loadModisRaster() {
  console.log("Loading MODIS Land Cover raster...");
  console.log("  Step 1/3: Opening TIFF file...");
  const tiff = await fromFile("lib/data/biome-gen/EarthData/MODIS/MCD12C1_LandCover.tif");

  console.log("  Step 2/3: Reading image metadata...");
  const image = await tiff.getImage();
  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  console.log(`  Image size: ${width}x${height} pixels (${(width * height / 1e6).toFixed(1)}M pixels)`);

  console.log("  Step 3/3: Loading raster data into memory...");
  const rasters = await image.readRasters();
  console.log("  ✅ MODIS raster loaded successfully!");
  console.log(`  BBox: [${bbox.join(", ")}]`);

  return {
    data: rasters[0] as any,
    bbox,
    width,
    height,
  };
}

async function loadKoppenRaster() {
  console.log("Loading Köppen-Geiger climate raster (fallback)...");
  console.log("  Step 1/3: Opening TIFF file...");
  const tiff = await fromFile("lib/data/biome-gen/Beck KG/Climate/Beck_KG_V1_present_0p0083.tif");

  console.log("  Step 2/3: Reading image metadata...");
  const image = await tiff.getImage();
  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  console.log(`  Image size: ${width}x${height} pixels (${(width * height / 1e6).toFixed(1)}M pixels)`);

  console.log("  Step 3/3: Loading raster data into memory...");
  const rasters = await image.readRasters();
  console.log("  ✅ Köppen raster loaded successfully!");
  console.log(`  BBox: [${bbox.join(", ")}]`);

  return {
    data: rasters[0] as any,
    bbox,
    width,
    height,
  };
}

async function loadShapefileIntoRTree(
  filepath: string,
  description: string
): Promise<RBush<SpatialItem>> {
  console.log(`Loading ${description}...`);
  const tree = new RBush<SpatialItem>();
  const source = await shapefile.open(filepath);
  const items: SpatialItem[] = [];

  let result = await source.read();
  while (!result.done) {
    const feature = result.value;
    const bboxCoords = bbox(feature);
    items.push({
      minX: bboxCoords[0],
      minY: bboxCoords[1],
      maxX: bboxCoords[2],
      maxY: bboxCoords[3],
      feature,
    });
    result = await source.read();
  }

  tree.load(items);
  console.log(`  ✅ Loaded ${items.length} features into spatial index`);
  return tree;
}

function sampleRasterValue(
  lat: number,
  lon: number,
  raster: { data: any; bbox: number[]; width: number; height: number }
): number {
  const [west, south, east, north] = raster.bbox;

  // Clamp to raster bounds
  lat = Math.max(south, Math.min(north, lat));
  lon = Math.max(west, Math.min(east, lon));

  const x = Math.floor(((lon - west) / (east - west)) * raster.width);
  const y = Math.floor(((north - lat) / (north - south)) * raster.height);

  const index = y * raster.width + x;
  const value = raster.data[index];

  return value || 0;
}

function getDistanceToNearestFeature(
  lat: number,
  lon: number,
  tree: RBush<SpatialItem>,
  searchRadiusDegrees: number = SPATIAL_SEARCH_RADIUS_DEGREES
): number {
  const point = turf.point([lon, lat]);

  // Search for nearby features within spatial search radius
  const nearby = tree.search({
    minX: lon - searchRadiusDegrees,
    minY: lat - searchRadiusDegrees,
    maxX: lon + searchRadiusDegrees,
    maxY: lat + searchRadiusDegrees,
  });

  if (nearby.length === 0) {
    return Infinity;
  }

  let minDistance = Infinity;
  for (const item of nearby) {
    try {
      const distance = turf.pointToLineDistance(point, item.feature as any, {
        units: "kilometers",
      });
      if (distance < minDistance) {
        minDistance = distance;
      }
    } catch (err) {
      // Skip invalid geometries
      continue;
    }
  }

  return minDistance;
}

function applyBiomeBuffersToGrid(
  grid: BiomeGrid,
  coastlineTree: RBush<SpatialItem>,
  lakesTree: RBush<SpatialItem>,
  riversTree: RBush<SpatialItem>
): BiomeGrid {
  // Apply distance-based buffer expansion for each biome type
  // This second pass expands detected biomes into neighboring cells based on
  // their configured buffer distance (in kilometers).

  const expandedGrid = { ...grid };
  let cellsModified = 0;

  for (const [key, biome] of Object.entries(grid)) {
    const bufferKm = BIOME_BUFFERS[biome];

    // Skip biomes with no buffer expansion
    if (bufferKm === 0) continue;

    const [latStr, lonStr] = key.split('_');
    const sourceLat = parseFloat(latStr);
    const sourceLon = parseFloat(lonStr);

    // Calculate how many grid cells this buffer spans
    // At equator: 111 km per degree, elsewhere use cos(latitude) correction
    const bufferDegrees = bufferKm / (111 * Math.cos((sourceLat * Math.PI) / 180));
    const bufferCells = Math.ceil(bufferDegrees / GRID_RESOLUTION);

    // Expand biome into neighboring cells within buffer radius
    for (let dLat = -bufferCells; dLat <= bufferCells; dLat++) {
      for (let dLon = -bufferCells; dLon <= bufferCells; dLon++) {
        // Skip the center cell (already has the biome)
        if (dLat === 0 && dLon === 0) continue;

        const neighborLat = sourceLat + dLat * GRID_RESOLUTION;
        const neighborLon = sourceLon + dLon * GRID_RESOLUTION;

        // Skip cells outside valid geographic range
        if (neighborLat < -90 || neighborLat > 90 || neighborLon < -180 || neighborLon > 180) {
          continue;
        }

        // Calculate actual distance from source to neighbor (in km)
        const point1 = turf.point([sourceLon, sourceLat]);
        const point2 = turf.point([neighborLon, neighborLat]);
        const distanceKm = turf.distance(point1, point2, { units: "kilometers" });

        // Only apply buffer if within the specified distance
        if (distanceKm <= bufferKm) {
          const neighborKey = `${neighborLat.toFixed(1)}_${neighborLon.toFixed(1)}`;
          const existingBiome = expandedGrid[neighborKey];

          // Apply buffer expansion logic:
          // - ocean: don't expand (sharp boundaries)
          // - field: expand into (it's the neutral baseline)
          // - other detected biomes: only overwrite field (more specific takes precedence)
          if (existingBiome === "field" || (biome === "ocean" && existingBiome === "ocean")) {
            expandedGrid[neighborKey] = biome;
            cellsModified++;
          }
        }
      }
    }
  }

  console.log(`  ✅ Buffer expansion complete: ${cellsModified.toLocaleString()} cells modified`);
  return expandedGrid;
}

async function buildBiomeGrid(): Promise<BiomeGrid> {
  console.log("=".repeat(60));
  console.log("Building Biome Detection Data (Unified Distance Buffers)");
  console.log("=".repeat(60));
  console.log(`Grid resolution: ${GRID_RESOLUTION}° (~${Math.round(GRID_RESOLUTION * 111)}km)`);
  console.log(`Spatial search radius: ${SPATIAL_SEARCH_RADIUS_DEGREES}°`);
  console.log();
  console.log("Biome distance buffers (applied during grid generation):");
  for (const [biome, bufferKm] of Object.entries(BIOME_BUFFERS)) {
    console.log(`  ${biome.padEnd(6)}: ${bufferKm} km`);
  }
  console.log();

  // Load all data sources
  console.log("Loading data sources...");
  const modisRaster = await loadModisRaster();
  const koppenRaster = await loadKoppenRaster();

  const coastlineTree = await loadShapefileIntoRTree(
    "lib/data/biome-gen/Natural Earth/Coastline/10m/ne_10m_coastline.shp",
    "10m coastlines (high detail)"
  );

  const lakesTree = await loadShapefileIntoRTree(
    "lib/data/biome-gen/Natural Earth/Lakes + Reservoirs/10m/ne_10m_lakes.shp",
    "10m lakes (high detail)"
  );

  const riversTree = await loadShapefileIntoRTree(
    "lib/data/biome-gen/Natural Earth/Centerlines/10m/ne_10m_rivers_lake_centerlines.shp",
    "10m rivers (high detail)"
  );

  console.log();
  console.log("Starting unified biome detection with distance buffers...");
  console.log();

  const grid: BiomeGrid = {};
  let totalPoints = 0;
  let processedPoints = 0;

  // Calculate total grid points
  for (let lat = -90; lat <= 90; lat += GRID_RESOLUTION) {
    for (let lon = -180; lon <= 180; lon += GRID_RESOLUTION) {
      totalPoints++;
    }
  }

  console.log(`Processing ${totalPoints.toLocaleString()} grid points with distance buffers...`);
  const startTime = Date.now();

  for (let lat = -90; lat <= 90; lat += GRID_RESOLUTION) {
    for (let lon = -180; lon <= 180; lon += GRID_RESOLUTION) {
      const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
      let biome: BiomeType = "field"; // Default fallback

      // Step 1: Sample primary raster sources (MODIS, Köppen-Geiger)
      const modisValue = sampleRasterValue(lat, lon, modisRaster);
      biome = MODIS_TO_BIOME[modisValue];

      // Step 2: Fallback to Köppen if MODIS has no data
      if (!biome) {
        const koppenValue = sampleRasterValue(lat, lon, koppenRaster);
        biome = KOPPEN_TO_BIOME[koppenValue] || "field";
      }

      // Step 3: Apply distance-based buffers for detected biome
      // This is the unified approach: apply outward distance buffers based on biome type
      // to propagate the biome type to nearby cells within the specified distance.
      const bufferDistance = BIOME_BUFFERS[biome];

      // For non-zero buffers, mark this cell and later expand during a second pass
      // For now, record the detected biome with full priority weight
      grid[key] = biome;

      // Step 4: Apply distance-based refinements for land cells
      // Priority 1: Check distance to inland water (lakes/rivers)
      if (biome !== "ocean") {
        const distToLakes = getDistanceToNearestFeature(lat, lon, lakesTree, SPATIAL_SEARCH_RADIUS_DEGREES);
        const distToRivers = getDistanceToNearestFeature(lat, lon, riversTree, SPATIAL_SEARCH_RADIUS_DEGREES);
        const distToWater = Math.min(distToLakes, distToRivers);

        // Lake buffer: 111 km (1 degree cell)
        if (distToWater <= BIOME_BUFFERS.lake) {
          biome = "lake";
        } else {
          // Priority 2: Check distance to coastline for beach detection
          const distToCoast = getDistanceToNearestFeature(lat, lon, coastlineTree, SPATIAL_SEARCH_RADIUS_DEGREES);
          // Beach buffer: 222 km (2 degree cells)
          if (distToCoast <= BIOME_BUFFERS.beach) {
            biome = "beach";
          }
        }
      }

      // Update grid with final biome after all refinements
      grid[key] = biome;
      processedPoints++;

      if (processedPoints % 1000 === 0) {
        const percent = ((processedPoints / totalPoints) * 100).toFixed(1);
        const elapsed = Date.now() - startTime;
        const rate = processedPoints / (elapsed / 1000);
        const remaining = (totalPoints - processedPoints) / rate;
        const etaDate = new Date(Date.now() + remaining * 1000);
        const eta = etaDate.toLocaleTimeString();
        console.log(
          `  Progress: ${percent}% (${processedPoints.toLocaleString()}/${totalPoints.toLocaleString()}) - ${rate.toFixed(0)} pts/sec - ETA: ${eta}`
        );
      }
    }
  }

  console.log("  ✅ Grid generation complete: All cells assigned with distance buffers!");

  // Apply biome buffer expansion (distance-based propagation)
  console.log("Applying biome buffer expansion (distance-based propagation)...");
  const expandedGrid = applyBiomeBuffersToGrid(grid, coastlineTree, lakesTree, riversTree);

  return expandedGrid;
}

async function main() {
  try {
    const grid = await buildBiomeGrid();

    // Calculate statistics
    const stats: Record<BiomeType, number> = {
      ocean: 0,
      lake: 0,
      beach: 0,
      desert: 0,
      field: 0,
      forest: 0,
      city: 0,
    };

    Object.values(grid).forEach((biome) => {
      stats[biome]++;
    });

    const totalCells = Object.keys(grid).length;
    console.log("\nBiome Distribution:");
    console.log(`  Ocean:  ${stats.ocean.toLocaleString()} cells (${((stats.ocean / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Lake:   ${stats.lake.toLocaleString()} cells (${((stats.lake / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Beach:  ${stats.beach.toLocaleString()} cells (${((stats.beach / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Desert: ${stats.desert.toLocaleString()} cells (${((stats.desert / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Field:  ${stats.field.toLocaleString()} cells (${((stats.field / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Forest: ${stats.forest.toLocaleString()} cells (${((stats.forest / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  City:   ${stats.city.toLocaleString()} cells (${((stats.city / totalCells) * 100).toFixed(1)}%)`);

    // Write to file
    const outputPath = path.join(__dirname, "../lib/data/biomes.json");
    fs.writeFileSync(outputPath, JSON.stringify(grid, null, 2));

    const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`\nOutput: ${outputPath}`);
    console.log(`File size: ${fileSizeKB} KB`);

    console.log("\n✅ Biome data generation complete!");
  } catch (error) {
    console.error("Error building biome data:", error);
    process.exit(1);
  }
}

main();
