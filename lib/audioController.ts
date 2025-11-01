/**
 * High-level audio controller for Skypin soundscape.
 *
 * Bridges the gap between weather data and the audio system.
 * Provides a simple API for the UI layer to trigger soundscape changes.
 *
 * Usage pattern:
 * 1. Initialize audio system (requires user interaction)
 * 2. Preload sounds (optional but recommended)
 * 3. Update soundscape whenever weather/location changes
 */

import { getAudioManager } from './audioManager';
import { getSoundLayers } from './soundMapping';
import { getTimeOfDay } from './biomeUtils';
import { getAllSoundIds } from './audioUtils';
import type { BiomeType } from './biomeDetector';
import type { TimeOfDay } from './biomeUtils';
import type { WeatherData } from '@/types/weather';
import type { SoundLayer } from '@/types/audio';

/**
 * Configuration for soundscape transitions.
 */
export interface SoundscapeTransitionConfig {
  /** Fade-out duration for old sounds in seconds */
  fadeOutDuration: number;

  /** Fade-in duration for new sounds in seconds */
  fadeInDuration: number;

  /** Whether to stop all sounds before starting new ones */
  clearAll: boolean;
}

/**
 * Default transition configuration.
 * Smooth 5-second crossfades for pleasant soundscape changes.
 */
const DEFAULT_TRANSITION: SoundscapeTransitionConfig = {
  fadeOutDuration: 5,
  fadeInDuration: 5,
  clearAll: false,
};

/**
 * AudioController - High-level soundscape management.
 *
 * Coordinates AudioManager and sound mapping to create cohesive
 * ambient soundscapes based on weather and location data.
 */
export class AudioController {
  private audioManager = getAudioManager();
  private currentSoundscape: SoundLayer[] = [];
  private isReady = false;

  /**
   * Initialize the audio system.
   *
   * MUST be called in response to user interaction (click, tap) to satisfy
   * browser autoplay policies.
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * const controller = new AudioController();
   * await controller.initialize();  // Call after user clicks "Start"
   */
  async initialize(): Promise<void> {
    if (this.isReady) {
      console.warn('AudioController already initialized');
      return;
    }

    try {
      await this.audioManager.init();
      this.isReady = true;
      console.log('AudioController initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioController:', error);
      throw error;
    }
  }

  /**
   * Preload all audio files for instant playback.
   *
   * Recommended to call during app loading after initialization.
   * Can be called progressively or all at once.
   *
   * @param soundIds - Optional array of specific sounds to preload (defaults to all)
   * @returns Promise that resolves when preloading is complete
   *
   * @example
   * await controller.preloadSounds();  // Preload everything
   */
  async preloadSounds(soundIds?: string[]): Promise<void> {
    if (!this.isReady) {
      throw new Error('AudioController not initialized. Call initialize() first.');
    }

    const idsToLoad = soundIds || getAllSoundIds();
    await this.audioManager.preloadSounds(idsToLoad);
  }

  /**
   * Update the soundscape based on weather data.
   *
   * Intelligently transitions from the current soundscape to a new one,
   * fading out removed sounds and fading in new ones.
   *
   * @param weatherData - Current weather and biome data
   * @param config - Optional transition configuration
   *
   * @example
   * controller.updateSoundscape(weatherData, {
   *   fadeOutDuration: 3,
   *   fadeInDuration: 4,
   *   clearAll: false
   * });
   */
  updateSoundscape(
    weatherData: WeatherData,
    config: Partial<SoundscapeTransitionConfig> = {}
  ): void {
    if (!this.isReady) {
      console.error('AudioController not initialized');
      return;
    }

    const transition = { ...DEFAULT_TRANSITION, ...config };

    // Extract relevant data
    const biome = weatherData.biome.type;
    const timeOfDay = getTimeOfDay(weatherData.location.localtime);
    const weatherCode = weatherData.current.condition.code;
    const windSpeed = weatherData.current.wind_kph;
    const humidity = weatherData.current.humidity;

    // Get new sound layers
    const newLayers = getSoundLayers(biome, timeOfDay, weatherCode, windSpeed, humidity);

    console.log(`Updating soundscape for ${biome} at ${timeOfDay}:`, {
      layers: newLayers.length,
      weather: weatherCode,
      wind: `${windSpeed} kph`,
    });

    // Apply soundscape transition
    this.transitionSoundscape(newLayers, transition);

    // Update current state
    this.currentSoundscape = newLayers;
  }

  /**
   * Transition from current soundscape to new layer configuration.
   *
   * Strategy:
   * 1. Identify sounds to remove (in old, not in new)
   * 2. Identify sounds to add (in new, not in old)
   * 3. Identify sounds to keep (in both, may adjust volume)
   * 4. Fade out removed sounds
   * 5. Fade in new sounds
   * 6. Adjust volume for kept sounds
   *
   * @param newLayers - Target sound layer configuration
   * @param config - Transition configuration
   */
  private transitionSoundscape(
    newLayers: SoundLayer[],
    config: SoundscapeTransitionConfig
  ): void {
    // If clearAll is true, stop everything and start fresh
    if (config.clearAll) {
      this.audioManager.stopAll(config.fadeOutDuration);
      setTimeout(() => {
        newLayers.forEach((layer) => {
          this.audioManager.play(layer.soundId, {
            volume: layer.volume,
            loop: layer.loop,
            fadeInDuration: config.fadeInDuration,
            category: layer.category,
            startDelay: layer.startDelay,
          });
        });
      }, config.fadeOutDuration * 1000);
      return;
    }

    // Build maps for comparison
    const currentMap = new Map(this.currentSoundscape.map((l) => [l.soundId, l]));
    const newMap = new Map(newLayers.map((l) => [l.soundId, l]));

    // Find sounds to remove
    const toRemove = this.currentSoundscape.filter((layer) => !newMap.has(layer.soundId));

    // Find sounds to add
    const toAdd = newLayers.filter((layer) => !currentMap.has(layer.soundId));

    // Find sounds to keep (may need volume adjustment)
    const toKeep = newLayers.filter((layer) => currentMap.has(layer.soundId));

    // Remove old sounds
    toRemove.forEach((layer) => {
      this.audioManager.stop(layer.soundId, config.fadeOutDuration);
    });

    // Add new sounds
    toAdd.forEach((layer) => {
      this.audioManager.play(layer.soundId, {
        volume: layer.volume,
        loop: layer.loop,
        fadeInDuration: layer.fadeInDuration || config.fadeInDuration,
        category: layer.category,
        startDelay: layer.startDelay,
      });
    });

    // Adjust volume for kept sounds
    toKeep.forEach((layer) => {
      const currentLayer = currentMap.get(layer.soundId)!;
      if (Math.abs(currentLayer.volume - layer.volume) > 0.05) {
        // Only adjust if volume change is significant
        this.audioManager.setVolume(layer.soundId, layer.volume, config.fadeInDuration);
      }
    });

    console.log('Soundscape transition:', {
      removed: toRemove.map((l) => l.soundId),
      added: toAdd.map((l) => l.soundId),
      kept: toKeep.map((l) => l.soundId),
    });
  }

  /**
   * Manually trigger a soundscape for specific conditions.
   *
   * Useful for testing or manual control without full weather data.
   *
   * @param biome - Biome type
   * @param timeOfDay - Time of day
   * @param weatherCode - WMO weather code
   * @param windSpeed - Wind speed in kph
   * @param humidity - Humidity percentage
   * @param config - Optional transition configuration
   *
   * @example
   * controller.setSoundscape('forest', 'night', 0, 10, 80);
   */
  setSoundscape(
    biome: BiomeType,
    timeOfDay: TimeOfDay,
    weatherCode: number,
    windSpeed: number,
    humidity: number,
    config: Partial<SoundscapeTransitionConfig> = {}
  ): void {
    if (!this.isReady) {
      console.error('AudioController not initialized');
      return;
    }

    const transition = { ...DEFAULT_TRANSITION, ...config };
    const newLayers = getSoundLayers(biome, timeOfDay, weatherCode, windSpeed, humidity);

    this.transitionSoundscape(newLayers, transition);
    this.currentSoundscape = newLayers;
  }

  /**
   * Stop the current soundscape.
   *
   * @param fadeOutDuration - Fade-out time in seconds (default: 3)
   *
   * @example
   * controller.stopSoundscape(5);  // Fade out over 5 seconds
   */
  stopSoundscape(fadeOutDuration = 3): void {
    this.audioManager.stopAll(fadeOutDuration);
    this.currentSoundscape = [];
  }

  /**
   * Set master volume.
   *
   * @param volume - Volume level (0.0 to 1.0)
   *
   * @example
   * controller.setMasterVolume(0.7);  // 70% volume
   */
  setMasterVolume(volume: number): void {
    this.audioManager.setMasterVolume(volume);
  }

  /**
   * Toggle mute state.
   *
   * @returns New mute state (true if muted)
   *
   * @example
   * const isMuted = controller.toggleMute();
   */
  toggleMute(): boolean {
    return this.audioManager.toggleMute();
  }

  /**
   * Get current soundscape layers.
   *
   * @returns Array of active sound layers
   */
  getCurrentSoundscape(): SoundLayer[] {
    return [...this.currentSoundscape];
  }

  /**
   * Get current audio system state.
   *
   * @returns Audio system state information
   */
  getState() {
    return this.audioManager.getState();
  }

  /**
   * Get list of currently playing sounds.
   *
   * @returns Array of active sound IDs
   */
  getActiveSounds(): string[] {
    return this.audioManager.getActiveSounds();
  }

  /**
   * Check if audio system is ready.
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Clean up audio resources.
   *
   * Call when the audio system is no longer needed.
   */
  dispose(): void {
    this.audioManager.dispose();
    this.currentSoundscape = [];
    this.isReady = false;
  }
}

// Export singleton instance for convenience
let audioControllerInstance: AudioController | null = null;

/**
 * Get the global AudioController singleton instance.
 *
 * @returns Global AudioController instance
 *
 * @example
 * import { getAudioController } from '@/lib/audioController';
 *
 * const controller = getAudioController();
 * await controller.initialize();
 * controller.updateSoundscape(weatherData);
 */
export function getAudioController(): AudioController {
  if (!audioControllerInstance) {
    audioControllerInstance = new AudioController();
  }
  return audioControllerInstance;
}

/**
 * Reset the global AudioController instance.
 *
 * @example
 * resetAudioController();  // Clean up and create fresh instance
 */
export function resetAudioController(): void {
  if (audioControllerInstance) {
    audioControllerInstance.dispose();
    audioControllerInstance = null;
  }
}
