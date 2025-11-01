/**
 * Core Audio Engine for Skypin Ambient Soundscape.
 *
 * Web Audio API-based manager that handles:
 * - Multiple simultaneous looping tracks with seamless crossfades
 * - Exponential volume curves for natural-sounding transitions
 * - Preloading and caching of audio buffers
 * - Master volume and mute control
 * - Intelligent loop scheduling to prevent gaps
 *
 * Design principles:
 * - Never silence: At least one sound always playing
 * - Smooth transitions: All volume changes use exponential ramps
 * - Resource efficient: Preload once, reuse AudioBuffers
 * - Error resilient: Handle autoplay restrictions and missing files gracefully
 */

import type { AudioTrack, PlayOptions, AudioSystemState } from '@/types/audio';
import {
  getAudioPath,
  getAudioPathVariants,
  calculateFadeDuration,
} from './audioUtils';

/**
 * AudioManager - Web Audio API-based sound engine.
 *
 * Singleton pattern recommended for single global audio context.
 * Manages all audio playback, looping, crossfading, and volume control.
 */
export class AudioManager {
  // Web Audio API core
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;

  // Track management
  private activeTracks: Map<string, AudioTrack> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private loopTimeouts: Map<string, number> = new Map();

  // State
  private isMuted = false;
  private masterVolume = 1.0;
  private isInitialized = false;
  private preloadComplete = false;
  private failedLoads: string[] = [];

  /**
   * Initialize the audio context and master gain node.
   *
   * Must be called in response to user interaction (click, tap) to satisfy
   * browser autoplay policies. Call this before attempting to play any sounds.
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if Web Audio API is not supported
   *
   * @example
   * const audioManager = new AudioManager();
   * await audioManager.init();  // Call after user clicks "Start" button
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('AudioManager already initialized');
      return;
    }

    // Check for Web Audio API support
    if (!('AudioContext' in window) && !('webkitAudioContext' in window)) {
      throw new Error('Web Audio API not supported in this browser');
    }

    try {
      // Create audio context (use webkit prefix for older Safari)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Create dynamics compressor to prevent clipping and control max volume
      // This acts as a "limiter" to ensure audio never gets too loud
      this.compressorNode = this.audioContext.createDynamicsCompressor();

      // Configure compressor settings
      // threshold: -10dB (start compressing when audio exceeds this level)
      // knee: 10dB (smooth transition into compression)
      // ratio: 12:1 (aggressive limiting - for every 12dB over threshold, only allow 1dB through)
      // attack: 0.003s (3ms - fast response to prevent peaks)
      // release: 0.25s (250ms - smooth recovery)
      this.compressorNode.threshold.value = -10;
      this.compressorNode.knee.value = 10;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // Create master gain node for volume control
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.masterVolume;

      // Audio chain: individual track gains → master gain → compressor → destination
      this.masterGainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.audioContext.destination);

      // Resume context if suspended (autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log('AudioManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw new Error('Failed to initialize audio system');
    }
  }

  /**
   * Preload all audio files into memory.
   *
   * Fetches and decodes audio files in parallel for instant playback.
   * Call this during app loading or after init() to prepare the audio system.
   *
   * @param soundIds - Array of sound IDs to preload (if empty, preloads all)
   * @returns Promise that resolves when all files are loaded
   *
   * @example
   * await audioManager.preloadSounds(['birds_far', 'rain_medium', 'wind_forest_medium']);
   */
  async preloadSounds(soundIds: string[]): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioManager not initialized. Call init() first.');
    }

    console.log(`Preloading ${soundIds.length} audio files...`);
    const startTime = Date.now();

    // Load all sounds in parallel
    const loadPromises = soundIds.map((soundId) => this.loadAudioBuffer(soundId));
    await Promise.allSettled(loadPromises);

    const duration = Date.now() - startTime;
    const successCount = soundIds.length - this.failedLoads.length;

    console.log(
      `Preloaded ${successCount}/${soundIds.length} audio files in ${duration}ms`
    );

    if (this.failedLoads.length > 0) {
      console.warn('Failed to load sounds:', this.failedLoads);
    }

    this.preloadComplete = true;
  }

  /**
   * Load and decode a single audio file into an AudioBuffer.
   *
   * Tries multiple file extensions (.ogg, .mp3, .wav) for browser compatibility.
   * Caches the buffer for reuse.
   *
   * @param soundId - Sound identifier
   * @returns Promise resolving to AudioBuffer
   */
  private async loadAudioBuffer(soundId: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    // Check if already loaded
    if (this.audioBuffers.has(soundId)) {
      return this.audioBuffers.get(soundId)!;
    }

    // Try all available file formats
    const paths = getAudioPathVariants(soundId);

    for (const path of paths) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        this.audioBuffers.set(soundId, audioBuffer);
        return audioBuffer;
      } catch (error) {
        // Try next format
        continue;
      }
    }

    // All formats failed
    console.error(`Failed to load audio file: ${soundId}`);
    this.failedLoads.push(soundId);
    return null;
  }

  /**
   * Play a sound with specified options.
   *
   * Creates a new AudioBufferSourceNode and applies fade-in if requested.
   * For looping tracks, automatically schedules seamless crossfades.
   *
   * @param soundId - Sound identifier to play
   * @param options - Playback configuration
   *
   * @example
   * audioManager.play('birds_far', {
   *   volume: 0.6,
   *   loop: true,
   *   fadeInDuration: 3,
   *   category: 'base'
   * });
   */
  play(soundId: string, options: PlayOptions): void {
    if (!this.audioContext || !this.masterGainNode) {
      console.error('AudioManager not initialized');
      return;
    }

    // Load buffer if not already loaded
    if (!this.audioBuffers.has(soundId)) {
      console.warn(`Sound not preloaded: ${soundId}. Loading now...`);
      this.loadAudioBuffer(soundId).then((buffer) => {
        if (buffer) {
          this.play(soundId, options);
        }
      });
      return;
    }

    const buffer = this.audioBuffers.get(soundId);
    if (!buffer) {
      console.error(`Failed to get buffer for sound: ${soundId}`);
      return;
    }

    // Stop existing track with this ID (if any), unless it's already fading out
    const existingTrack = this.activeTracks.get(soundId);
    if (existingTrack && !existingTrack.isFadingOut) {
      this.stop(soundId, options.fadeInDuration || 0);
    }

    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Create gain node for individual track volume control
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.masterGainNode);

    // Connect source to gain
    source.connect(gainNode);

    // Set initial volume (start at 0 if fading in)
    const startVolume = options.fadeInDuration ? 0 : options.volume;
    gainNode.gain.value = startVolume;

    // Start playback with optional delay (minimum 0.02s for Web Audio API stability)
    const minDelay = 0.02;
    const startTime = this.audioContext.currentTime + Math.max(minDelay, options.startDelay || 0);
    source.start(startTime);

    // Apply fade-in if requested
    if (options.fadeInDuration && options.fadeInDuration > 0) {
      this.fadeVolume(gainNode, 0, options.volume, options.fadeInDuration, startTime);
    }

    // Store track info
    const track: AudioTrack = {
      soundId,
      source,
      gainNode,
      volume: options.volume,
      isLooping: options.loop,
      category: options.category || 'base',
      startTime: startTime,
      duration: buffer.duration,
      isFadingOut: false,
    };

    this.activeTracks.set(soundId, track);

    // Schedule loop if enabled
    if (options.loop) {
      this.scheduleLoop(soundId, track);
    }

    // Handle track end (for non-looping tracks)
    source.onended = () => {
      if (!options.loop) {
        this.activeTracks.delete(soundId);
        this.loopTimeouts.delete(soundId);
      }
    };
  }

  /**
   * Schedule seamless loop restart with crossfade.
   *
   * Starts fading in the next iteration before the current one ends,
   * creating a smooth, gap-free loop. Both fade-out and fade-in use the
   * same duration to ensure perfect symmetry, which masks any imperfections
   * in the audio loop points.
   *
   * @param soundId - Sound identifier
   * @param track - Active track to loop
   */
  private scheduleLoop(soundId: string, track: AudioTrack): void {
    if (!this.audioContext) return;

    // Clear any existing loop timeout
    const existingTimeout = this.loopTimeouts.get(soundId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate when to start the crossfade (12.5% of track length, 2-30 seconds)
    const fadeDuration = calculateFadeDuration(track.duration);
    const timeUntilCrossfade = Math.max(0, track.duration - fadeDuration) * 1000;

    console.log(
      `Scheduling loop crossfade for ${soundId}: ${fadeDuration.toFixed(1)}s fade after ${(
        timeUntilCrossfade / 1000
      ).toFixed(1)}s`
    );

    // Schedule the crossfade
    const timeoutId = window.setTimeout(() => {
      if (!this.activeTracks.has(soundId)) return;

      const currentTrack = this.activeTracks.get(soundId)!;

      // Mark track as fading out to prevent play() from stopping it prematurely
      currentTrack.isFadingOut = true;

      // IMPORTANT: Use the same fadeDuration for both fade-out and fade-in
      // This creates symmetrical crossfade that hides any loop point mismatches

      // Fade out current iteration
      this.fadeVolume(currentTrack.gainNode, currentTrack.volume, 0, fadeDuration);

      // Schedule cleanup of old track after fade completes
      setTimeout(() => {
        if (currentTrack.source) {
          try {
            currentTrack.source.stop();
          } catch (e) {
            // Source might already be stopped
          }
        }
      }, fadeDuration * 1000 + 100);

      // Remove from active tracks immediately so play() can create new one
      this.activeTracks.delete(soundId);

      // Fade in new iteration (using same fadeDuration for symmetry)
      this.play(soundId, {
        volume: currentTrack.volume,
        loop: true,
        fadeInDuration: fadeDuration, // ← Same duration as fade-out
        category: currentTrack.category,
      });
    }, timeUntilCrossfade);

    this.loopTimeouts.set(soundId, timeoutId);
  }

  /**
   * Stop a playing sound with optional fade-out.
   *
   * @param soundId - Sound identifier to stop
   * @param fadeOutDuration - Fade-out time in seconds (0 for immediate stop)
   *
   * @example
   * audioManager.stop('rain_medium', 5);  // Fade out over 5 seconds
   */
  stop(soundId: string, fadeOutDuration = 0): void {
    const track = this.activeTracks.get(soundId);
    if (!track) return;

    // Clear any scheduled loop
    const loopTimeout = this.loopTimeouts.get(soundId);
    if (loopTimeout) {
      clearTimeout(loopTimeout);
      this.loopTimeouts.delete(soundId);
    }

    if (fadeOutDuration > 0) {
      // Fade out, then stop
      track.isFadingOut = true;
      this.fadeVolume(track.gainNode, track.volume, 0, fadeOutDuration);

      setTimeout(() => {
        track.source.stop();
        this.activeTracks.delete(soundId);
      }, fadeOutDuration * 1000);
    } else {
      // Immediate stop
      track.source.stop();
      this.activeTracks.delete(soundId);
    }
  }

  /**
   * Stop all active sounds with optional fade-out.
   *
   * @param fadeOutDuration - Fade-out time in seconds
   *
   * @example
   * audioManager.stopAll(3);  // Fade out all sounds over 3 seconds
   */
  stopAll(fadeOutDuration = 0): void {
    const soundIds = Array.from(this.activeTracks.keys());
    soundIds.forEach((soundId) => this.stop(soundId, fadeOutDuration));
  }

  /**
   * Set volume for a specific sound.
   *
   * @param soundId - Sound identifier
   * @param volume - Target volume (0.0 to 1.0)
   * @param fadeDuration - Fade time in seconds (0 for immediate)
   *
   * @example
   * audioManager.setVolume('wind_forest_medium', 0.3, 2);  // Fade to 30% over 2s
   */
  setVolume(soundId: string, volume: number, fadeDuration = 0): void {
    const track = this.activeTracks.get(soundId);
    if (!track) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (fadeDuration > 0) {
      this.fadeVolume(track.gainNode, track.volume, clampedVolume, fadeDuration);
    } else {
      track.gainNode.gain.value = clampedVolume;
    }

    track.volume = clampedVolume;
  }

  /**
   * Set master volume for all sounds.
   *
   * @param volume - Master volume level (0.0 to 1.0)
   *
   * @example
   * audioManager.setMasterVolume(0.5);  // Set to 50% volume
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGainNode) return;

    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGainNode.gain.value = this.isMuted ? 0 : this.masterVolume;
  }

  /**
   * Toggle mute state.
   *
   * @returns New mute state (true if muted)
   *
   * @example
   * const isMuted = audioManager.toggleMute();
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.isMuted ? 0 : this.masterVolume;
    }

    return this.isMuted;
  }

  /**
   * Apply exponential volume fade to a gain node.
   *
   * Exponential curves sound more natural than linear to human ears.
   *
   * @param gainNode - GainNode to fade
   * @param startVolume - Initial volume
   * @param endVolume - Target volume
   * @param duration - Fade duration in seconds
   * @param startTime - Optional start time (default: now + small delay)
   */
  private fadeVolume(
    gainNode: GainNode,
    startVolume: number,
    endVolume: number,
    duration: number,
    startTime?: number
  ): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    // Always schedule slightly in the future to avoid Web Audio API timing issues
    const start = startTime || now + 0.01;
    const end = start + duration;

    // Cancel any existing automation from now onwards
    gainNode.gain.cancelScheduledValues(now);

    // Use exponential ramp (avoid 0 value issues with epsilon)
    const epsilon = 0.001;
    const safeStart = Math.max(epsilon, startVolume);
    const safeEnd = Math.max(epsilon, endVolume);

    // If starting from (or near) silence and fading up
    if (startVolume < epsilon && endVolume >= epsilon) {
      gainNode.gain.setValueAtTime(epsilon, start);
      gainNode.gain.exponentialRampToValueAtTime(safeEnd, end);
    } else if (endVolume < epsilon) {
      gainNode.gain.setValueAtTime(safeStart, start);
      gainNode.gain.exponentialRampToValueAtTime(epsilon, end - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, end);
    } else {
      gainNode.gain.setValueAtTime(safeStart, start);
      gainNode.gain.exponentialRampToValueAtTime(safeEnd, end);
    }
  }

  /**
   * Get current audio system state for debugging/UI.
   *
   * @returns Current state of the audio system
   *
   * @example
   * const state = audioManager.getState();
   * console.log(`Active tracks: ${state.activeTrackCount}`);
   */
  getState(): AudioSystemState {
    return {
      initialized: this.isInitialized,
      preloaded: this.preloadComplete,
      muted: this.isMuted,
      masterVolume: this.masterVolume,
      activeTrackCount: this.activeTracks.size,
      failedLoads: [...this.failedLoads],
    };
  }

  /**
   * Get list of currently playing sound IDs.
   *
   * @returns Array of active sound IDs
   *
   * @example
   * const playing = audioManager.getActiveSounds();
   * console.log('Now playing:', playing);
   */
  getActiveSounds(): string[] {
    return Array.from(this.activeTracks.keys());
  }

  /**
   * Check if a specific sound is currently playing.
   *
   * @param soundId - Sound identifier to check
   * @returns True if sound is active
   *
   * @example
   * if (audioManager.isPlaying('rain_medium')) {
   *   console.log('Rain is playing');
   * }
   */
  isPlaying(soundId: string): boolean {
    return this.activeTracks.has(soundId);
  }

  /**
   * Clean up audio resources and stop all playback.
   * Call this when the audio system is no longer needed.
   *
   * @example
   * audioManager.dispose();
   */
  dispose(): void {
    // Stop all tracks
    this.stopAll(0);

    // Clear all timeouts
    this.loopTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.loopTimeouts.clear();

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    // Clear references
    this.audioContext = null;
    this.masterGainNode = null;
    this.activeTracks.clear();
    this.audioBuffers.clear();
    this.isInitialized = false;
    this.preloadComplete = false;
  }
}

// Export singleton instance for convenience
let audioManagerInstance: AudioManager | null = null;

/**
 * Get the global AudioManager singleton instance.
 *
 * Creates a new instance if one doesn't exist.
 *
 * @returns Global AudioManager instance
 *
 * @example
 * import { getAudioManager } from '@/lib/audioManager';
 *
 * const audio = getAudioManager();
 * await audio.init();
 */
export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

/**
 * Reset the global AudioManager instance.
 * Useful for testing or reinitializing the audio system.
 *
 * @example
 * resetAudioManager();  // Clean up and create fresh instance
 */
export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
    audioManagerInstance = null;
  }
}
