/**
 * Audio utility functions for Skypin soundscape system.
 *
 * Provides helpers for file path mapping, fade duration calculation,
 * weather intensity analysis, and volume curve generation.
 */

import type { WeatherIntensity } from '@/types/audio';

/**
 * Map of sound IDs to their file paths WITH extensions.
 * Built by scanning the public/audio directory structure.
 *
 * Format: soundId → full path from /audio/ with extension
 * This avoids 404 errors by directly specifying the correct file extension.
 */
const SOUND_PATH_MAP: Record<string, string> = {
  // Animals
  birds_far: 'animals/birds_far.ogg',
  'birds-forest_light_far': 'animals/birds-forest_light_far.mp3',
  crickets_far: 'animals/crickets_far.ogg',
  'crickets-summer_far': 'animals/crickets-summer_far.ogg',
  frogs_close: 'animals/frogs_close.ogg',

  // City
  'cars-passing_low_far': 'city/cars-passing_low_far.mp3',
  'cars-passing_medium_close': 'city/cars-passing_medium_close.mp3',
  'chatter-footsteps_medium': 'city/chatter-footsteps_medium.mp3',
  'church-bells_medium_far': 'city/church-bells_medium_far.mp3',
  'rain-wind-city-traffic_medium_far': 'city/rain-wind-city-traffic_medium_far.mp3',
  traffic_medium_close: 'city/traffic_medium_close.ogg',
  traffic_medium_far: 'city/traffic_medium_far.ogg',

  // Thunder
  thunder_light_far: 'thunder/thunder_light_far.ogg',
  thunder_medium_close: 'thunder/thunder_medium_close.ogg',

  // Water
  'drops-bucket-collecting-drips_light_close':
    'water/drops-bucket-collecting-drips_light_close.mp3',
  rain_light: 'water/rain_light.ogg',
  rain_medium: 'water/rain_medium.ogg',
  stream_light_close: 'water/stream_light_close.ogg',
  stream_medium: 'water/stream_medium.ogg',
  waterfall_light: 'water/waterfall_light.ogg',
  waterfall_medium: 'water/waterfall_medium.ogg',
  waves_medium_close: 'water/waves_medium_close.ogg',
  waves_medium_far: 'water/waves_medium_far.ogg',
  waves_small_close: 'water/waves_small_close.ogg',

  // Wind
  wind_autumn: 'wind/wind_autumn.ogg',
  wind_coastal_birds: 'wind/wind_coastal_birds.ogg',
  wind_coastal_medium_far: 'wind/wind_coastal_medium_far.ogg',
  wind_field_strong: 'wind/wind_field_strong.ogg',
  wind_forest_medium: 'wind/wind_forest_medium.ogg',
  wind_grass_strong: 'wind/wind_grass_strong.ogg',

  // Other
  fan_close: 'other/fan_close.ogg',
  windchimes_close: 'other/windchimes_close.ogg',
};

/**
 * Gets the full audio file path for a sound ID.
 *
 * @param soundId - Sound identifier (e.g., "birds_far", "rain_medium")
 * @returns Full path to audio file (e.g., "/audio/animals/birds_far.ogg")
 * @throws Error if sound ID is not found in mapping
 *
 * @example
 * getAudioPath("birds_far")  // → "/audio/animals/birds_far.ogg"
 * getAudioPath("rain_light") // → "/audio/water/rain_light.ogg"
 */
export function getAudioPath(soundId: string): string {
  const pathWithExtension = SOUND_PATH_MAP[soundId];

  if (!pathWithExtension) {
    throw new Error(`Unknown sound ID: ${soundId}`);
  }

  // Path already includes the correct extension
  return `/audio/${pathWithExtension}`;
}

/**
 * Gets all possible audio paths for a sound ID (with different extensions).
 * Used for fallback loading when primary format fails.
 *
 * @param soundId - Sound identifier
 * @returns Array of paths - first is the correct extension, rest are fallbacks
 *
 * @example
 * getAudioPathVariants("birds_far")
 * // → ["/audio/animals/birds_far.ogg", "/audio/animals/birds_far.mp3", "/audio/animals/birds_far.wav"]
 */
export function getAudioPathVariants(soundId: string): string[] {
  const pathWithExtension = SOUND_PATH_MAP[soundId];

  if (!pathWithExtension) {
    throw new Error(`Unknown sound ID: ${soundId}`);
  }

  // Return the correct path first, then fallback to other extensions
  const correctPath = `/audio/${pathWithExtension}`;

  // Extract the base path without extension for fallback attempts
  const basePath = pathWithExtension.replace(/\.(mp3|ogg|wav)$/, '');
  const allPaths = ['.mp3', '.ogg', '.wav'].map((ext) => `/audio/${basePath}${ext}`);

  // Filter out duplicates and put the correct one first
  const uniquePaths = [correctPath, ...allPaths.filter(p => p !== correctPath)];

  return uniquePaths;
}

/**
 * Calculates optimal fade duration based on track length.
 *
 * Strategy:
 * - Use 10-15% of track length for natural crossfades
 * - Cap at 30 seconds maximum (avoid excessively long fades)
 * - Minimum 2 seconds (avoid abrupt transitions)
 *
 * @param trackLengthSeconds - Duration of audio track in seconds
 * @returns Optimal fade duration in seconds
 *
 * @example
 * calculateFadeDuration(120)  // 2 min track → 15 seconds
 * calculateFadeDuration(30)   // 30 sec track → 3 seconds
 * calculateFadeDuration(600)  // 10 min track → 30 seconds (capped)
 */
export function calculateFadeDuration(trackLengthSeconds: number): number {
  // Use 12.5% of track length as baseline
  const baseFade = trackLengthSeconds * 0.125;

  // Clamp between 2 and 30 seconds
  return Math.max(2, Math.min(30, baseFade));
}

/**
 * Maps WMO weather code to weather intensity metrics.
 *
 * WMO Weather Codes:
 * 0 - Clear sky
 * 1-3 - Mainly clear to overcast
 * 45, 48 - Fog
 * 51-57 - Drizzle (light to heavy)
 * 61-67 - Rain (slight to heavy, possible freezing)
 * 71-77 - Snow (slight to heavy)
 * 80-82 - Rain showers (slight to violent)
 * 85-86 - Snow showers
 * 95-99 - Thunderstorm (slight to heavy, with hail)
 *
 * @param weatherCode - WMO weather code (0-99)
 * @returns Object with intensity metrics for rain, thunder, snow, fog
 *
 * @example
 * mapWeatherToIntensity(61)  // Light rain → { rain: 0.3, thunder: 0, ... }
 * mapWeatherToIntensity(95)  // Thunderstorm → { rain: 0.7, thunder: 0.8, ... }
 */
export function mapWeatherToIntensity(weatherCode: number): WeatherIntensity {
  const intensity: WeatherIntensity = {
    rain: 0,
    thunder: 0,
    snow: false,
    fog: false,
    hasPrecipitation: false,
  };

  // Fog codes
  if (weatherCode === 45 || weatherCode === 48) {
    intensity.fog = true;
  }

  // Drizzle codes (51-57)
  if (weatherCode >= 51 && weatherCode <= 57) {
    intensity.rain = weatherCode <= 53 ? 0.2 : weatherCode <= 55 ? 0.35 : 0.5;
    intensity.hasPrecipitation = true;
  }

  // Rain codes (61-67)
  if (weatherCode >= 61 && weatherCode <= 67) {
    intensity.rain = weatherCode <= 63 ? 0.4 : weatherCode <= 65 ? 0.7 : 0.9;
    intensity.hasPrecipitation = true;
  }

  // Snow codes (71-77, 85-86)
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    intensity.snow = true;
    intensity.hasPrecipitation = true;
    // Snow sounds similar to light rain in ambient audio
    intensity.rain = 0.3;
  }

  // Rain shower codes (80-82)
  if (weatherCode >= 80 && weatherCode <= 82) {
    intensity.rain = weatherCode === 80 ? 0.5 : weatherCode === 81 ? 0.75 : 1.0;
    intensity.hasPrecipitation = true;
  }

  // Thunderstorm codes (95-99)
  if (weatherCode >= 95 && weatherCode <= 99) {
    intensity.rain = 0.8;
    intensity.thunder = weatherCode === 95 ? 0.6 : weatherCode === 96 ? 0.8 : 1.0;
    intensity.hasPrecipitation = true;
  }

  return intensity;
}

/**
 * Calculates volume adjustment based on wind speed.
 *
 * Strategy:
 * - Low wind (0-10 kph): Minimal wind ambience (0.2 volume)
 * - Medium wind (10-25 kph): Moderate wind layer (0.5 volume)
 * - Strong wind (25-40 kph): Prominent wind (0.8 volume)
 * - Extreme wind (40+ kph): Maximum wind presence (1.0 volume)
 *
 * @param windSpeedKph - Wind speed in kilometers per hour
 * @returns Wind layer volume (0.0 to 1.0)
 *
 * @example
 * calculateWindVolume(5)   // → 0.2 (gentle breeze)
 * calculateWindVolume(20)  // → 0.5 (moderate wind)
 * calculateWindVolume(45)  // → 1.0 (strong wind)
 */
export function calculateWindVolume(windSpeedKph: number): number {
  if (windSpeedKph < 10) {
    return 0.2;
  }
  if (windSpeedKph < 25) {
    return 0.2 + ((windSpeedKph - 10) / 15) * 0.3; // 0.2 → 0.5
  }
  if (windSpeedKph < 40) {
    return 0.5 + ((windSpeedKph - 25) / 15) * 0.3; // 0.5 → 0.8
  }
  return Math.min(1.0, 0.8 + ((windSpeedKph - 40) / 20) * 0.2); // 0.8 → 1.0
}

/**
 * Generates an exponential volume curve for natural-sounding fades.
 *
 * Linear volume changes sound unnatural to human ears. Exponential curves
 * provide smooth, perceptually-linear volume transitions.
 *
 * @param startVolume - Initial volume (0.0 to 1.0)
 * @param endVolume - Target volume (0.0 to 1.0)
 * @param steps - Number of intermediate steps (default: 20)
 * @returns Array of volume values forming exponential curve
 *
 * @example
 * generateExponentialCurve(0, 1, 5)  // → [0, 0.0625, 0.25, 0.5625, 1.0]
 * generateExponentialCurve(1, 0, 5)  // → [1.0, 0.5625, 0.25, 0.0625, 0]
 */
export function generateExponentialCurve(
  startVolume: number,
  endVolume: number,
  steps = 20
): number[] {
  const curve: number[] = [];
  const epsilon = 0.001; // Avoid log(0) issues

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Exponential interpolation: start * (end/start)^t
    const safeStart = Math.max(epsilon, startVolume);
    const safeEnd = Math.max(epsilon, endVolume);
    const value = safeStart * Math.pow(safeEnd / safeStart, t);
    curve.push(Math.max(0, Math.min(1, value)));
  }

  return curve;
}

/**
 * Converts a sound ID to a human-readable display name.
 *
 * @param soundId - Sound identifier
 * @returns Formatted display name
 *
 * @example
 * formatSoundName("birds_far")  // → "Birds (Far)"
 * formatSoundName("rain_medium")  // → "Rain (Medium)"
 */
export function formatSoundName(soundId: string): string {
  return soundId
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Gets all available sound IDs in the system.
 *
 * @returns Array of all registered sound IDs
 */
export function getAllSoundIds(): string[] {
  return Object.keys(SOUND_PATH_MAP);
}

/**
 * Checks if a sound ID exists in the system.
 *
 * @param soundId - Sound identifier to check
 * @returns True if sound exists
 */
export function soundExists(soundId: string): boolean {
  return soundId in SOUND_PATH_MAP;
}
