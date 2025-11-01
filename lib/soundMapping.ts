/**
 * Biome and weather to sound layer mapping system.
 *
 * Defines which audio files play for each biome type, time of day,
 * and weather condition. The mapping prioritizes realistic ambient
 * soundscapes with base layers, weather-reactive layers, and time accents.
 */

import type { BiomeType } from './biomeDetector';
import type { TimeOfDay } from './biomeUtils';
import type { SoundLayer } from '@/types/audio';
import {
  mapWeatherToIntensity,
  calculateWindVolume,
} from './audioUtils';

/**
 * Probability of including bird sounds (30% chance).
 * Birds are used sparingly to avoid overuse.
 */
const BIRD_SOUND_PROBABILITY = 0.3;

/**
 * Probability of including cricket layers (30% chance).
 * Keeps nocturnal accents from becoming repetitive.
 */
const CRICKET_SOUND_PROBABILITY = 0.3;

/**
 * Probability of including frog layers (30% chance).
 * Prevents night soundscapes from sounding identical.
 */
const FROG_SOUND_PROBABILITY = 0.3;

/**
 * Determines if bird sounds should be included based on probability.
 *
 * @returns True if birds should be included (30% of the time)
 */
function shouldIncludeBirds(): boolean {
  return Math.random() < BIRD_SOUND_PROBABILITY;
}

/**
 * Determines if cricket sounds should be included based on probability.
 *
 * @returns True if crickets should be included (30% of the time)
 */
function shouldIncludeCrickets(): boolean {
  return Math.random() < CRICKET_SOUND_PROBABILITY;
}

/**
 * Determines if frog sounds should be included based on probability.
 *
 * @returns True if frogs should be included (30% of the time)
 */
function shouldIncludeFrogs(): boolean {
  return Math.random() < FROG_SOUND_PROBABILITY;
}

/**
 * Gets the complete sound layer configuration for current conditions.
 *
 * Sound layers are prioritized as follows:
 * 1. Base ambient (always present, defines the biome soundscape)
 * 2. Weather layers (rain, thunder - conditional on weather code)
 * 3. Wind layers (volume scaled by wind speed)
 * 4. Time accents (crickets at night, church bells, etc.)
 * 5. Bird sounds (30% probability during daytime)
 *
 * @param biome - Detected biome type
 * @param timeOfDay - Current time classification (day/evening/night)
 * @param weatherCode - WMO weather code (0-99)
 * @param windSpeedKph - Wind speed in km/h
 * @param humidity - Relative humidity percentage (0-100)
 * @returns Array of sound layers to play simultaneously
 *
 * @example
 * getSoundLayers("forest", "evening", 0, 15, 65)
 * // Returns: [
 * //   { soundId: "birds-forest_light_far", volume: 0.6, category: "base", ... }, // (30% chance)
 * //   { soundId: "wind_forest_medium", volume: 0.4, category: "base", ... },
 * //   { soundId: "crickets_far", volume: 0.7, category: "accent", ... }
 * // ]
 */
export function getSoundLayers(
  biome: BiomeType,
  timeOfDay: TimeOfDay,
  weatherCode: number,
  windSpeedKph: number,
  humidity: number
): SoundLayer[] {
  const layers: SoundLayer[] = [];
  const weatherIntensity = mapWeatherToIntensity(weatherCode);

  // Determine if this soundscape should include birds
  const includeBirds = shouldIncludeBirds();
  const includeCrickets = shouldIncludeCrickets();
  const includeFrogs = shouldIncludeFrogs();

  // Delegate to biome-specific mapping functions
  switch (biome) {
    case 'city':
      layers.push(
        ...getCitySounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;

    case 'forest':
      layers.push(
        ...getForestSounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;

    case 'field':
      layers.push(
        ...getFieldSounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;

    case 'beach':
      layers.push(
        ...getBeachSounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;

    case 'lake':
      layers.push(
        ...getLakeSounds(
          timeOfDay,
          weatherIntensity,
          windSpeedKph,
          includeBirds,
          includeCrickets,
          includeFrogs
        )
      );
      break;

    case 'ocean':
      layers.push(
        ...getOceanSounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;

    case 'desert':
      layers.push(
        ...getDesertSounds(timeOfDay, weatherIntensity, windSpeedKph, includeBirds, includeCrickets)
      );
      break;
  }

  return layers;
}

/**
 * City biome soundscape.
 *
 * Base: Traffic ambience, urban chatter
 * Weather: City rain/traffic mix
 * Time: Church bells (morning/evening in some areas)
 *
 * Cities have constant ambient noise regardless of time of day.
 */
function getCitySounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base city ambience - always present
  layers.push({
    soundId: 'traffic_medium_close',
    volume: 0.5,
    loop: true,
    category: 'base',
  });

  layers.push({
    soundId: 'chatter-footsteps_medium',
    volume: 0.4,
    loop: true,
    category: 'base',
    fadeInDuration: 3,
  });

  // Add distant traffic for depth
  layers.push({
    soundId: 'traffic_medium_far',
    volume: 0.3,
    loop: true,
    category: 'base',
    fadeInDuration: 4,
  });

  // Weather: Rain + city traffic mix
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain-wind-city-traffic_medium_far',
      volume: Math.min(0.7, weather.rain * 0.9),
      loop: true,
      category: 'weather',
      fadeInDuration: 5,
    });
  }

  // Accent: Church bells in early morning or evening
  if (timeOfDay === 'evening') {
    layers.push({
      soundId: 'church-bells_medium_far',
      volume: 0.25,
      loop: true,
      category: 'accent',
      fadeInDuration: 2,
      startDelay: 10, // Delay to avoid overwhelming initial soundscape
    });
  }

  return layers;
}

/**
 * Forest biome soundscape.
 *
 * Base: Forest birds (30% chance), rustling wind through trees
 * Weather: Rain through canopy, distant thunder
 * Time: Crickets (30% chance) and frogs (30% chance) at night
 *
 * Forests are quieter at night with nocturnal sounds.
 */
function getForestSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Birds (daytime only, 30% chance)
  if (timeOfDay === 'day' && includeBirds) {
    layers.push({
      soundId: 'birds-forest_light_far',
      volume: 0.3,
      loop: true,
      category: 'base',
    });
  }

  // Base: Wind through forest (always present, volume varies)
  const windVolume = calculateWindVolume(windSpeedKph);
  layers.push({
    soundId: 'wind_forest_medium',
    volume: Math.max(0.3, windVolume * 0.7), // Never silent, scale with wind
    loop: true,
    category: 'base',
    fadeInDuration: 4,
  });

  // Weather: Rain through forest canopy
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_medium',
      volume: Math.min(0.65, weather.rain * 0.8),
      loop: true,
      category: 'weather',
      fadeInDuration: 6,
    });
  }

  // Weather: Thunder (if stormy)
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_light_far',
      volume: Math.min(0.5, weather.thunder * 0.6),
      loop: true,
      category: 'weather',
      fadeInDuration: 3,
    });
  }

  // Time accent: Crickets at evening/night (30% chance)
  if ((timeOfDay === 'evening' || timeOfDay === 'night') && includeCrickets) {
    layers.push({
      soundId: 'crickets_far',
      volume: timeOfDay === 'night' ? 0.35 : 0.25,
      loop: true,
      category: 'accent',
      fadeInDuration: 8,
    });
  }

  return layers;
}

/**
 * Field/grassland biome soundscape.
 *
 * Base: Distant birds (30% chance), wind through grass
 * Weather: Light rain on vegetation, distant thunder
 * Time: Summer crickets at evening/night (30% chance)
 *
 * Open fields emphasize wind and distant sounds.
 */
function getFieldSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Distant birds (daytime, 30% chance)
  if (timeOfDay === 'day' && includeBirds) {
    layers.push({
      soundId: 'birds_far',
      volume: 0.05,
      loop: true,
      category: 'base',
    });
  }

  // Base: Strong wind through grass/field (prominent in open areas)
  const windVolume = calculateWindVolume(windSpeedKph);
  layers.push({
    soundId: windSpeedKph > 20 ? 'wind_field_strong' : 'wind_grass_strong',
    volume: Math.max(0.4, windVolume * 0.9), // Wind is more prominent in fields
    loop: true,
    category: 'base',
    fadeInDuration: 3,
  });

  // Weather: Light rain on grass
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_light',
      volume: Math.min(0.6, weather.rain * 0.75),
      loop: true,
      category: 'weather',
      fadeInDuration: 5,
    });
  }

  // Weather: Distant thunder
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_light_far',
      volume: Math.min(0.45, weather.thunder * 0.55),
      loop: true,
      category: 'weather',
      fadeInDuration: 3,
    });
  }

  // Time accent: Summer crickets (evening/night, 30% chance)
  if ((timeOfDay === 'evening' || timeOfDay === 'night') && includeCrickets) {
    layers.push({
      soundId: 'crickets-summer_far',
      volume: timeOfDay === 'night' ? 0.375 : 0.275,
      loop: true,
      category: 'accent',
      fadeInDuration: 10,
    });
  }

  return layers;
}

/**
 * Beach biome soundscape.
 *
 * Base: Ocean waves (close), coastal wind with/without birds (30% chance)
 * Weather: Rain on beach, thunder
 * Time: No specific time accents (waves constant)
 *
 * Beaches have rhythmic wave patterns and coastal ambience.
 */
function getBeachSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Ocean waves (medium, close enough to hear detail)
  layers.push({
    soundId: 'waves_medium_close',
    volume: 0.65,
    loop: true,
    category: 'base',
  });

  // Base: Coastal wind with/without birds (30% chance for birds during daytime)
  const windVolume = calculateWindVolume(windSpeedKph);
  if (timeOfDay === 'day' && includeBirds) {
    layers.push({
      soundId: 'wind_coastal_birds',
      volume: Math.max(0.2, windVolume * 0.35),
      loop: true,
      category: 'base',
      fadeInDuration: 4,
    });
  } else {
    // Night or no birds: Just coastal wind
    layers.push({
      soundId: 'wind_coastal_medium_far',
      volume: Math.max(0.35, windVolume * 0.55),
      loop: true,
      category: 'base',
      fadeInDuration: 4,
    });
  }

  // Weather: Rain on beach
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_medium',
      volume: Math.min(0.55, weather.rain * 0.7),
      loop: true,
      category: 'weather',
      fadeInDuration: 5,
    });
  }

  // Weather: Thunder over ocean
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_medium_close',
      volume: Math.min(0.6, weather.thunder * 0.75),
      loop: true,
      category: 'weather',
      fadeInDuration: 2,
    });
  }

  return layers;
}

/**
 * Lake biome soundscape.
 *
 * Base: Small waves lapping, gentle wind, birds (30% chance)
 * Weather: Rain on water, distant thunder
 * Time: Frogs at night
 *
 * Lakes are calmer than ocean, with nocturnal wildlife.
 */
function getLakeSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean,
  includeFrogs: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Small waves lapping at shore
  layers.push({
    soundId: 'waves_small_close',
    volume: 0.5,
    loop: true,
    category: 'base',
  });

  // Base: Gentle wind (lakes are more sheltered)
  const windVolume = calculateWindVolume(windSpeedKph);
  layers.push({
    soundId: 'wind_autumn', // Softer wind sound
    volume: Math.max(0.25, windVolume * 0.5),
    loop: true,
    category: 'base',
    fadeInDuration: 5,
  });

  // Base: Birds (daytime, 30% chance)
  if (timeOfDay === 'day' && includeBirds) {
    layers.push({
      soundId: 'birds_far',
      volume: 0.2,
      loop: true,
      category: 'base',
      fadeInDuration: 3,
    });
  }

  // Weather: Rain on lake water
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_light',
      volume: Math.min(0.6, weather.rain * 0.75),
      loop: true,
      category: 'weather',
      fadeInDuration: 6,
    });
  }

  // Weather: Distant thunder
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_light_far',
      volume: Math.min(0.5, weather.thunder * 0.6),
      loop: true,
      category: 'weather',
      fadeInDuration: 3,
    });
  }

  // Time accent: Frogs at night (30% chance)
  if (timeOfDay === 'night' && includeFrogs) {
    layers.push({
      soundId: 'frogs_close',
      volume: 0.35,
      loop: true,
      category: 'accent',
      fadeInDuration: 12,
    });
  }

  return layers;
}

/**
 * Ocean biome soundscape.
 *
 * Base: Medium-far waves, coastal wind
 * Weather: Rain, thunder
 * Time: No specific accents (ocean is constant)
 *
 * Open ocean has distant wave sounds and stronger wind.
 */
function getOceanSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Distant ocean waves
  layers.push({
    soundId: 'waves_medium_far',
    volume: 0.6,
    loop: true,
    category: 'base',
  });

  // Base: Coastal wind (ocean winds tend to be steady)
  const windVolume = calculateWindVolume(windSpeedKph);
  layers.push({
    soundId: 'wind_coastal_medium_far',
    volume: Math.max(0.4, windVolume * 0.7),
    loop: true,
    category: 'base',
    fadeInDuration: 4,
  });

  // Weather: Rain on ocean
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_medium',
      volume: Math.min(0.6, weather.rain * 0.75),
      loop: true,
      category: 'weather',
      fadeInDuration: 5,
    });
  }

  // Weather: Thunder over water
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_medium_close',
      volume: Math.min(0.65, weather.thunder * 0.8),
      loop: true,
      category: 'weather',
      fadeInDuration: 2,
    });
  }

  return layers;
}

/**
 * Desert biome soundscape.
 *
 * Base: Strong wind (minimal other sounds), sparse birds (30% chance)
 * Weather: Rare rain, thunder
 * Time: Minimal variation (deserts are sparse)
 *
 * Deserts emphasize silence and wind, with sparse accents.
 */
function getDesertSounds(
  timeOfDay: TimeOfDay,
  weather: ReturnType<typeof mapWeatherToIntensity>,
  windSpeedKph: number,
  includeBirds: boolean,
  includeCrickets: boolean
): SoundLayer[] {
  const layers: SoundLayer[] = [];

  // Base: Wind (primary desert sound)
  const windVolume = calculateWindVolume(windSpeedKph);
  layers.push({
    soundId: 'wind_field_strong',
    volume: Math.max(0.35, windVolume * 0.8),
    loop: true,
    category: 'base',
    fadeInDuration: 3,
  });

  // Optional: Very subtle distant birds (day only, low volume, 30% chance)
  if (timeOfDay === 'day' && includeBirds) {
    layers.push({
      soundId: 'birds_far',
      volume: 0.1,
      loop: true,
      category: 'base',
      fadeInDuration: 5,
    });
  }

  // Weather: Rain (rare in desert, but dramatic when it occurs)
  if (weather.hasPrecipitation) {
    layers.push({
      soundId: 'rain_light',
      volume: Math.min(0.5, weather.rain * 0.65),
      loop: true,
      category: 'weather',
      fadeInDuration: 6,
    });
  }

  // Weather: Thunder (desert storms are intense)
  if (weather.thunder > 0) {
    layers.push({
      soundId: 'thunder_medium_close',
      volume: Math.min(0.7, weather.thunder * 0.85),
      loop: true,
      category: 'weather',
      fadeInDuration: 2,
    });
  }

  return layers;
}

/**
 * Gets a simplified list of active sound categories for debugging.
 *
 * @param layers - Array of sound layers
 * @returns Object with counts per category
 *
 * @example
 * getSoundLayerSummary(layers)  // → { base: 3, weather: 1, accent: 1 }
 */
export function getSoundLayerSummary(layers: SoundLayer[]): Record<string, number> {
  return layers.reduce(
    (summary, layer) => {
      summary[layer.category] = (summary[layer.category] || 0) + 1;
      return summary;
    },
    {} as Record<string, number>
  );
}
