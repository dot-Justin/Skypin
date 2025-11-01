"use client";

import { useAudio } from "./AudioProvider";

/**
 * Format biome name for display
 */
function formatBiomeName(biome: string | null): string {
  if (!biome) return "Ambient soundscape";

  // Convert snake_case to Title Case
  return biome
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * AudioControls - Main audio control UI
 *
 * Features:
 * - Simple volume slider
 * - Mute toggle
 * - Current biome indicator
 * - Matches page design style
 */
export default function AudioControls() {
  const { isReady, isMuted, volume, setVolume, toggleMute, currentBiome } =
    useAudio();

  // Don't render until audio is ready
  if (!isReady) {
    return null;
  }

  const volumePercentage = Math.round(volume * 100);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
      <div
        className="px-6 py-4 rounded-lg
                   bg-surface dark:bg-dark-surface
                   border border-accent-secondary/30 dark:border-dark-accent-secondary/30
                   min-w-[320px] md:min-w-[400px]"
      >
        <div className="flex items-center gap-4">
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="flex-shrink-0 p-2 rounded-lg
                       bg-surface dark:bg-dark-surface
                       border border-accent-secondary/30 dark:border-dark-accent-secondary/30
                       hover:border-accent-primary dark:hover:border-dark-accent-primary
                       text-text-primary dark:text-dark-text-primary
                       transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                />
              </svg>
            )}
          </button>

          {/* Volume Slider */}
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="range"
              min="0"
              max="100"
              value={volumePercentage}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer
                         bg-accent-secondary/20 dark:bg-dark-accent-secondary/20
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-accent-primary
                         dark:[&::-webkit-slider-thumb]:bg-dark-accent-primary
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-110
                         [&::-moz-range-thumb]:w-4
                         [&::-moz-range-thumb]:h-4
                         [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:bg-accent-primary
                         dark:[&::-moz-range-thumb]:bg-dark-accent-primary
                         [&::-moz-range-thumb]:border-0
                         [&::-moz-range-thumb]:cursor-pointer
                         [&::-moz-range-thumb]:transition-transform
                         [&::-moz-range-thumb]:hover:scale-110"
              aria-label="Volume"
            />
            <div className="text-xs text-text-secondary dark:text-dark-text-secondary text-center">
              {volumePercentage}%
            </div>
          </div>

          {/* Current Biome Indicator */}
          <div
            className="flex-shrink-0 text-right min-w-[80px]"
            title={formatBiomeName(currentBiome)}
          >
            <div className="text-xs text-text-secondary dark:text-dark-text-secondary">
              {formatBiomeName(currentBiome)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
