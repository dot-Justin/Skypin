"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { getAudioController } from "@/lib/audioController";
import type { BiomeType } from "@/lib/biomeDetector";
import type { WeatherData } from "@/types/weather";

interface AudioContextType {
  // State
  isReady: boolean;
  isMuted: boolean;
  volume: number;
  isLoading: boolean;
  currentBiome: BiomeType | null;
  hasInteracted: boolean;

  // Methods
  initialize: () => Promise<void>;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  updateSoundscape: (weatherData: WeatherData) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.7); // Default 70% volume
  const [isLoading, setIsLoading] = useState(false);
  const [currentBiome, setCurrentBiome] = useState<BiomeType | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const controllerRef = useRef(getAudioController());
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Initialize audio system (must be called from user interaction)
   */
  const initialize = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    if (isReady) {
      console.warn("Audio already initialized");
      return;
    }

    setIsLoading(true);
    const controller = controllerRef.current;

    const initPromise = (async () => {
      try {
        // Initialize audio context
        await controller.initialize();

        // Preload all audio files
        await controller.preloadSounds();

        // Set initial volume
        controller.setMasterVolume(volume);

        setIsReady(true);
        setHasInteracted(true);
        console.log("Audio system ready");
      } catch (error) {
        console.error("Failed to initialize audio:", error);
        throw error;
      } finally {
        setIsLoading(false);
        initializationPromiseRef.current = null;
      }
    })();

    initializationPromiseRef.current = initPromise;
    return initPromise;
  }, [isReady, volume]);

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    if (!isReady) return;

    const controller = controllerRef.current;
    const newMuteState = controller.toggleMute();
    setIsMuted(newMuteState);
  }, [isReady]);

  /**
   * Set volume level (0-1)
   */
  const setVolume = useCallback(
    (newVolume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      setVolumeState(clampedVolume);

      if (isReady) {
        const controller = controllerRef.current;
        controller.setMasterVolume(clampedVolume);
      }
    },
    [isReady]
  );

  /**
   * Update soundscape based on weather data
   */
  const updateSoundscape = useCallback(
    (weatherData: WeatherData) => {
      if (!isReady) {
        console.warn("Cannot update soundscape: audio not initialized");
        return;
      }

      const controller = controllerRef.current;
      controller.updateSoundscape(weatherData);
      setCurrentBiome(weatherData.biome.type);
    },
    [isReady]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isReady) {
        const controller = controllerRef.current;
        controller.stopSoundscape(2); // Gentle fade out
      }
    };
  }, [isReady]);

  const value: AudioContextType = {
    isReady,
    isMuted,
    volume,
    isLoading,
    currentBiome,
    hasInteracted,
    initialize,
    toggleMute,
    setVolume,
    updateSoundscape,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
