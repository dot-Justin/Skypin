/**
 * Audio system type definitions for Skypin ambient soundscape.
 *
 * These types define the core contracts for the Web Audio API-based
 * audio engine, sound layering system, and biome-to-sound mappings.
 */

/**
 * Sound category classification for layering system.
 *
 * - base: Core ambient layer (always playing, defines the soundscape)
 * - weather: Conditional layers triggered by weather conditions
 * - accent: Time-of-day or situational elements (crickets, church bells, etc.)
 */
export type SoundCategory = 'base' | 'weather' | 'accent';

/**
 * Playback options for starting a sound track.
 */
export interface PlayOptions {
  /** Audio volume (0.0 to 1.0) */
  volume: number;

  /** Whether to loop the track indefinitely */
  loop: boolean;

  /** Optional fade-in duration in seconds (uses exponential ramp) */
  fadeInDuration?: number;

  /** Optional delay before starting playback in seconds */
  startDelay?: number;

  /** Sound category for organizational purposes */
  category?: SoundCategory;
}

/**
 * Information about an active audio track in the system.
 * Internal to AudioManager for tracking playback state.
 */
export interface AudioTrack {
  /** Unique identifier for this sound */
  soundId: string;

  /** Web Audio API buffer source node */
  source: AudioBufferSourceNode;

  /** Individual gain node for this track */
  gainNode: GainNode;

  /** Current volume level (0.0 to 1.0) */
  volume: number;

  /** Whether this track is set to loop */
  isLooping: boolean;

  /** Sound category classification */
  category: SoundCategory;

  /** Timestamp when the track started playing */
  startTime: number;

  /** Duration of the audio buffer in seconds */
  duration: number;

  /** Whether this track is currently fading out */
  isFadingOut: boolean;
}

/**
 * Configuration for a sound layer in the soundscape.
 * Returned by sound mapping functions to describe which sounds to play.
 */
export interface SoundLayer {
  /** Unique sound identifier (maps to audio filename without extension) */
  soundId: string;

  /** Target volume (0.0 to 1.0) */
  volume: number;

  /** Whether to loop this sound indefinitely */
  loop: boolean;

  /** Sound category for layering logic */
  category: SoundCategory;

  /** Optional fade-in duration in seconds */
  fadeInDuration?: number;

  /** Optional delay before starting in seconds */
  startDelay?: number;
}

/**
 * Weather intensity classification based on WMO weather codes.
 * Used to determine volume and layer selection for weather sounds.
 */
export interface WeatherIntensity {
  /** Rain intensity (0.0 = none, 1.0 = heavy downpour) */
  rain: number;

  /** Thunder/storm intensity (0.0 = none, 1.0 = severe thunderstorm) */
  thunder: number;

  /** Whether snow is occurring */
  snow: boolean;

  /** Whether fog/mist is present */
  fog: boolean;

  /** General precipitation presence (true if any precipitation) */
  hasPrecipitation: boolean;
}

/**
 * Audio system initialization state.
 */
export interface AudioSystemState {
  /** Whether AudioContext has been initialized */
  initialized: boolean;

  /** Whether all audio files have been preloaded */
  preloaded: boolean;

  /** Whether audio is currently muted */
  muted: boolean;

  /** Master volume level (0.0 to 1.0) */
  masterVolume: number;

  /** Number of active tracks currently playing */
  activeTrackCount: number;

  /** List of sound IDs that failed to load */
  failedLoads: string[];
}
