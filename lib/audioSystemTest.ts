/**
 * Audio system test utilities and demo functions.
 *
 * Provides functions to test the audio engine independently of the UI.
 * Useful for debugging, validation, and development.
 */

import { getAudioController } from './audioController';
import { getAllSoundIds } from './audioUtils';
import type { BiomeType } from './biomeDetector';
import type { TimeOfDay } from './biomeUtils';
import type { WeatherData } from '@/types/weather';

/**
 * Test basic audio system initialization and playback.
 *
 * @returns Test results object
 */
export async function testAudioSystem(): Promise<{
  success: boolean;
  errors: string[];
  results: Record<string, any>;
}> {
  const errors: string[] = [];
  const results: Record<string, any> = {};
  const controller = getAudioController();

  try {
    // Test 1: Initialization
    console.log('Test 1: Initializing audio system...');
    await controller.initialize();
    results.initialized = controller.isInitialized();

    if (!results.initialized) {
      errors.push('Failed to initialize audio controller');
      return { success: false, errors, results };
    }

    // Test 2: Get all sound IDs
    console.log('Test 2: Checking available sounds...');
    const soundIds = getAllSoundIds();
    results.totalSounds = soundIds.length;
    console.log(`Found ${soundIds.length} sound files`);

    // Test 3: Preload sounds
    console.log('Test 3: Preloading audio files...');
    const preloadStart = Date.now();
    await controller.preloadSounds();
    const preloadDuration = Date.now() - preloadStart;
    results.preloadDuration = preloadDuration;

    const state = controller.getState();
    results.preloaded = state.preloaded;
    results.failedLoads = state.failedLoads;

    if (state.failedLoads.length > 0) {
      errors.push(`Failed to load ${state.failedLoads.length} sounds`);
      console.warn('Failed sounds:', state.failedLoads);
    }

    // Test 4: Play a simple sound
    console.log('Test 4: Testing single sound playback...');
    controller.setSoundscape('field', 'day', 0, 10, 60, { clearAll: true });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const activeSounds = controller.getActiveSounds();
    results.activeSounds = activeSounds;
    console.log('Active sounds:', activeSounds);

    if (activeSounds.length === 0) {
      errors.push('No sounds playing after setSoundscape');
    }

    // Test 5: Volume control
    console.log('Test 5: Testing volume control...');
    controller.setMasterVolume(0.5);
    const stateAfterVolume = controller.getState();
    results.masterVolume = stateAfterVolume.masterVolume;

    if (Math.abs(stateAfterVolume.masterVolume - 0.5) > 0.01) {
      errors.push('Master volume not set correctly');
    }

    // Test 6: Mute/unmute
    console.log('Test 6: Testing mute toggle...');
    const muteState1 = controller.toggleMute();
    const muteState2 = controller.toggleMute();
    results.muteToggle = muteState1 !== muteState2;

    if (!results.muteToggle) {
      errors.push('Mute toggle not working');
    }

    // Clean up
    console.log('Cleaning up test...');
    controller.stopSoundscape(0);

    return {
      success: errors.length === 0,
      errors,
      results,
    };
  } catch (error) {
    errors.push(`Unexpected error: ${error}`);
    return { success: false, errors, results };
  }
}

/**
 * Test all biome soundscapes sequentially.
 *
 * Plays each biome for a short duration to verify sound mapping.
 *
 * @param durationPerBiome - How long to play each biome (seconds)
 */
export async function testAllBiomes(durationPerBiome = 5): Promise<void> {
  const controller = getAudioController();

  if (!controller.isInitialized()) {
    await controller.initialize();
    await controller.preloadSounds();
  }

  const biomes: BiomeType[] = ['city', 'forest', 'field', 'beach', 'lake', 'ocean', 'desert'];
  const times: TimeOfDay[] = ['day', 'evening', 'night'];

  console.log(`Testing all biomes (${durationPerBiome}s each)...`);

  for (const biome of biomes) {
    for (const time of times) {
      console.log(`\n=== Testing ${biome} at ${time} ===`);

      controller.setSoundscape(biome, time, 0, 15, 60, {
        fadeInDuration: 2,
        fadeOutDuration: 2,
        clearAll: true,
      });

      const layers = controller.getCurrentSoundscape();
      console.log(`Layers: ${layers.map((l) => l.soundId).join(', ')}`);

      await new Promise((resolve) => setTimeout(resolve, durationPerBiome * 1000));
    }
  }

  controller.stopSoundscape(2);
  console.log('\nBiome test complete');
}

/**
 * Test weather transitions (clear → rain → thunderstorm).
 *
 * @param biome - Biome to test in
 * @param durationPerCondition - How long to stay in each condition (seconds)
 */
export async function testWeatherTransitions(
  biome: BiomeType = 'forest',
  durationPerCondition = 10
): Promise<void> {
  const controller = getAudioController();

  if (!controller.isInitialized()) {
    await controller.initialize();
    await controller.preloadSounds();
  }

  const conditions = [
    { name: 'Clear', code: 0, wind: 10 },
    { name: 'Light Rain', code: 61, wind: 15 },
    { name: 'Heavy Rain', code: 65, wind: 25 },
    { name: 'Thunderstorm', code: 95, wind: 35 },
    { name: 'Clear Again', code: 0, wind: 10 },
  ];

  console.log(`Testing weather transitions in ${biome}...`);

  for (const condition of conditions) {
    console.log(`\n=== ${condition.name} ===`);

    controller.setSoundscape(biome, 'day', condition.code, condition.wind, 70, {
      fadeInDuration: 3,
      fadeOutDuration: 3,
      clearAll: false, // Allow smooth transitions
    });

    const layers = controller.getCurrentSoundscape();
    console.log(`Active layers: ${layers.map((l) => `${l.soundId} (${l.category})`).join(', ')}`);

    await new Promise((resolve) => setTimeout(resolve, durationPerCondition * 1000));
  }

  controller.stopSoundscape(3);
  console.log('\nWeather transition test complete');
}

/**
 * Test time-of-day transitions (day → evening → night → day).
 *
 * @param biome - Biome to test in
 * @param durationPerTime - How long to stay in each time period (seconds)
 */
export async function testTimeTransitions(
  biome: BiomeType = 'forest',
  durationPerTime = 8
): Promise<void> {
  const controller = getAudioController();

  if (!controller.isInitialized()) {
    await controller.initialize();
    await controller.preloadSounds();
  }

  const times: TimeOfDay[] = ['day', 'evening', 'night'];

  console.log(`Testing time-of-day transitions in ${biome}...`);

  for (const time of times) {
    console.log(`\n=== ${time.toUpperCase()} ===`);

    controller.setSoundscape(biome, time, 0, 15, 65, {
      fadeInDuration: 4,
      fadeOutDuration: 4,
      clearAll: false,
    });

    const layers = controller.getCurrentSoundscape();
    console.log(`Active sounds: ${layers.map((l) => l.soundId).join(', ')}`);

    await new Promise((resolve) => setTimeout(resolve, durationPerTime * 1000));
  }

  controller.stopSoundscape(3);
  console.log('\nTime transition test complete');
}

/**
 * Create a mock WeatherData object for testing.
 *
 * @param biome - Biome type
 * @param weatherCode - WMO weather code
 * @param windSpeed - Wind speed in kph
 * @param localtime - ISO timestamp (defaults to current time)
 * @returns Mock WeatherData object
 */
export function createMockWeatherData(
  biome: BiomeType,
  weatherCode = 0,
  windSpeed = 15,
  localtime?: string
): WeatherData {
  return {
    location: {
      name: 'Test Location',
      region: 'Test Region',
      country: 'Test Country',
      localtime: localtime || new Date().toISOString(),
    },
    current: {
      temp_f: 72,
      temp_c: 22,
      condition: {
        text: 'Test Condition',
        code: weatherCode,
      },
      wind_mph: windSpeed * 0.621371,
      wind_kph: windSpeed,
      wind_dir: 180,
      humidity: 65,
      feelslike_f: 72,
      feelslike_c: 22,
    },
    biome: {
      type: biome,
      coordinates: {
        lat: 40.7128,
        lon: -74.006,
      },
    },
  };
}

/**
 * Test updateSoundscape with mock weather data.
 *
 * @param biome - Biome to test
 * @param weatherCode - Weather condition
 * @param duration - How long to play (seconds)
 */
export async function testWithMockWeather(
  biome: BiomeType,
  weatherCode = 0,
  duration = 10
): Promise<void> {
  const controller = getAudioController();

  if (!controller.isInitialized()) {
    await controller.initialize();
    await controller.preloadSounds();
  }

  const mockData = createMockWeatherData(biome, weatherCode, 15);

  console.log(`Testing updateSoundscape with ${biome}, weather code ${weatherCode}...`);

  controller.updateSoundscape(mockData, {
    fadeInDuration: 3,
    fadeOutDuration: 2,
    clearAll: true,
  });

  const layers = controller.getCurrentSoundscape();
  console.log('Sound layers:', layers);

  await new Promise((resolve) => setTimeout(resolve, duration * 1000));

  controller.stopSoundscape(2);
  console.log('Mock weather test complete');
}

/**
 * Run a comprehensive audio system validation.
 *
 * Tests initialization, preloading, playback, transitions, and controls.
 *
 * @returns Validation report
 */
export async function runFullValidation(): Promise<{
  passed: number;
  failed: number;
  details: string[];
}> {
  const details: string[] = [];
  let passed = 0;
  let failed = 0;

  console.log('\n=== AUDIO SYSTEM VALIDATION ===\n');

  // Test 1: Basic system test
  details.push('Test 1: Basic system functionality');
  const basicTest = await testAudioSystem();
  if (basicTest.success) {
    passed++;
    details.push('  ✓ PASSED');
  } else {
    failed++;
    details.push('  ✗ FAILED: ' + basicTest.errors.join(', '));
  }

  // Test 2: Short biome test
  details.push('\nTest 2: Sample biome soundscapes');
  try {
    await testAllBiomes(2); // 2 seconds per biome
    passed++;
    details.push('  ✓ PASSED');
  } catch (error) {
    failed++;
    details.push(`  ✗ FAILED: ${error}`);
  }

  // Test 3: Weather transition
  details.push('\nTest 3: Weather transitions');
  try {
    await testWeatherTransitions('forest', 3); // 3 seconds per condition
    passed++;
    details.push('  ✓ PASSED');
  } catch (error) {
    failed++;
    details.push(`  ✗ FAILED: ${error}`);
  }

  // Test 4: Mock weather data
  details.push('\nTest 4: Mock weather integration');
  try {
    await testWithMockWeather('beach', 95, 5); // Thunderstorm on beach
    passed++;
    details.push('  ✓ PASSED');
  } catch (error) {
    failed++;
    details.push(`  ✗ FAILED: ${error}`);
  }

  console.log('\n=== VALIDATION COMPLETE ===');
  console.log(`Passed: ${passed}/${passed + failed}`);
  console.log(`Failed: ${failed}/${passed + failed}`);

  return { passed, failed, details };
}

/**
 * Browser console helper to test audio system.
 *
 * Add this to browser console for interactive testing:
 *
 * ```javascript
 * // Initialize and test
 * const { testAudioSystem } = await import('./lib/audioSystemTest');
 * await testAudioSystem();
 *
 * // Test specific biome
 * const { testWithMockWeather } = await import('./lib/audioSystemTest');
 * await testWithMockWeather('forest', 95, 15);  // Forest thunderstorm for 15s
 * ```
 */
export const consoleHelp = `
Skypin Audio System Test Functions:

1. Basic Test:
   await testAudioSystem()

2. Test All Biomes:
   await testAllBiomes(5)  // 5 seconds per biome

3. Test Weather Transitions:
   await testWeatherTransitions('forest', 10)

4. Test Time Transitions:
   await testTimeTransitions('beach', 8)

5. Test with Mock Data:
   await testWithMockWeather('city', 61, 15)  // City with rain for 15s

6. Full Validation:
   await runFullValidation()

Weather Codes:
  0 = Clear
  61 = Light Rain
  65 = Heavy Rain
  95 = Thunderstorm
`;
