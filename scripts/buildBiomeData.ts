import * as fs from "fs";
import * as path from "path";
import { fromFile } from "geotiff";
import * as shapefile from "shapefile";
import * as turf from "@turf/turf";
import { Feature, Point } from "geojson";

type BiomeType = "ocean" | "beach" | "desert" | "field" | "forest";

interface BiomeGrid {
  [key: string]: BiomeType;
}

const GRID_RESOLUTION = 1.0; // degrees (~111km at equator)
const COASTAL_BUFFER_KM = 50;

// Köppen-Geiger classification to biome mapping
// Format: First letter = main climate group, second = precipitation, third = temperature
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

async function loadKoppenRaster() {
  console.log("Loading Köppen-Geiger climate raster...");
  console.log("  Step 1/3: Opening TIFF file...");
  const tiff = await fromFile("lib/data/climate classification/Beck_KG_V1_present_0p0083.tif");

  console.log("  Step 2/3: Reading image metadata...");
  const image = await tiff.getImage();
  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  console.log(`  Image size: ${width}x${height} pixels (${(width * height / 1e6).toFixed(1)}M pixels)`);

  console.log("  Step 3/3: Loading raster data into memory...");
  const rasters = await image.readRasters();
  console.log("  ✅ Raster loaded successfully!");
  console.log(`  BBox: [${bbox.join(", ")}]`);

  return {
    data: rasters[0] as any, // Climate classification values
    bbox,
    width,
    height,
  };
}

async function loadCoastlineSegments() {
  console.log("Loading coastline segments for distance calculations...");
  console.log("  Using 50m resolution coastlines for faster processing");
  const source = await shapefile.open("lib/data/coastline/50m/ne_50m_coastline.shp");
  const features: Feature[] = [];

  let result = await source.read();
  while (!result.done) {
    features.push(result.value);
    result = await source.read();
  }

  console.log(`✅ Loaded ${features.length} coastline segments`);
  return features;
}

function sampleKoppenValue(
  lat: number,
  lon: number,
  raster: { data: any; bbox: number[]; width: number; height: number }
): number {
  // Convert lat/lon to pixel coordinates
  const [west, south, east, north] = raster.bbox;

  // Clamp to raster bounds
  lat = Math.max(south, Math.min(north, lat));
  lon = Math.max(west, Math.min(east, lon));

  const x = Math.floor(((lon - west) / (east - west)) * raster.width);
  const y = Math.floor(((north - lat) / (north - south)) * raster.height);

  const index = y * raster.width + x;
  const value = raster.data[index];

  return value || 0; // 0 = no data/ocean
}

function getDistanceToCoast(
  lat: number,
  lon: number,
  coastlines: Feature[]
): number {
  const point = turf.point([lon, lat]);
  let minDistance = Infinity;

  for (const coastline of coastlines) {
    try {
      const distance = turf.pointToLineDistance(point, coastline as any, {
        units: "kilometers",
      });
      if (distance < minDistance) {
        minDistance = distance;
      }
      // Early exit if we're already beyond beach threshold
      if (minDistance <= COASTAL_BUFFER_KM) {
        return minDistance;
      }
    } catch (err) {
      continue;
    }
  }

  return minDistance;
}

async function buildBiomeGrid(): Promise<BiomeGrid> {
  console.log("=".repeat(60));
  console.log("Building Biome Detection Data (Köppen Raster Method)");
  console.log("=".repeat(60));
  console.log(`Grid resolution: ${GRID_RESOLUTION}° (~${Math.round(GRID_RESOLUTION * 111)}km)`);

  const raster = await loadKoppenRaster();
  const coastlines = await loadCoastlineSegments();

  const grid: BiomeGrid = {};
  let totalPoints = 0;
  let processedPoints = 0;

  // Calculate total points
  for (let lat = -90; lat <= 90; lat += GRID_RESOLUTION) {
    for (let lon = -180; lon <= 180; lon += GRID_RESOLUTION) {
      totalPoints++;
    }
  }

  console.log(`Processing ${totalPoints} grid points...`);
  const startTime = Date.now();

  for (let lat = -90; lat <= 90; lat += GRID_RESOLUTION) {
    for (let lon = -180; lon <= 180; lon += GRID_RESOLUTION) {
      const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;

      // Sample Köppen classification value
      const koppenValue = sampleKoppenValue(lat, lon, raster);

      // Map to biome
      let biome = KOPPEN_TO_BIOME[koppenValue] || "field";

      // If land (not ocean), check distance to coast for beach detection
      if (biome !== "ocean") {
        const distToCoast = getDistanceToCoast(lat, lon, coastlines);
        if (distToCoast <= COASTAL_BUFFER_KM) {
          biome = "beach";
        }
      }

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
          `Progress: ${percent}% (${processedPoints}/${totalPoints}) - ${rate.toFixed(0)} pts/sec - ETA: ${eta}`
        );
      }
    }
  }

  console.log("Grid generation complete!");
  return grid;
}

async function main() {
  try {
    const grid = await buildBiomeGrid();

    // Calculate statistics
    const stats: Record<BiomeType, number> = {
      ocean: 0,
      beach: 0,
      desert: 0,
      field: 0,
      forest: 0,
    };

    Object.values(grid).forEach((biome) => {
      stats[biome]++;
    });

    const totalCells = Object.keys(grid).length;
    console.log("\nBiome Distribution:");
    console.log(`  Ocean:  ${stats.ocean.toLocaleString()} cells (${((stats.ocean / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Beach:  ${stats.beach.toLocaleString()} cells (${((stats.beach / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Desert: ${stats.desert.toLocaleString()} cells (${((stats.desert / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Field:  ${stats.field.toLocaleString()} cells (${((stats.field / totalCells) * 100).toFixed(1)}%)`);
    console.log(`  Forest: ${stats.forest.toLocaleString()} cells (${((stats.forest / totalCells) * 100).toFixed(1)}%)`);

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
