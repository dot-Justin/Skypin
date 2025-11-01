"use client";

import { useState } from "react";
import { useAudio } from "./AudioProvider";

/**
 * StartAudioButton - Simple initialization trigger
 *
 * Appears before audio is initialized to satisfy browser autoplay policies.
 * Disappears once audio system is ready.
 */
export default function StartAudioButton() {
  const { initialize, isReady, isLoading, hasInteracted } = useAudio();
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    try {
      await initialize();
    } catch (err) {
      console.error("Failed to start audio:", err);
      setError("Failed to start audio. Please try again.");
    }
  };

  // Don't render if user has already interacted
  if (hasInteracted || isReady) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 dark:bg-dark-background/95">
      <div className="text-center space-y-6 px-6">
        {/* Title */}
        <div>
          <h2 className="text-4xl md:text-5xl font-serif mb-3">
            Ready to listen?
          </h2>
          <p className="text-text-secondary dark:text-dark-text-secondary text-lg">
            Immerse yourself in ambient soundscapes
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="px-10 py-4 rounded-lg
                     bg-accent-secondary dark:bg-dark-accent-secondary
                     hover:bg-accent-primary dark:hover:bg-dark-accent-primary
                     text-text-primary dark:text-dark-text-primary
                     font-medium text-lg
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          aria-label={isLoading ? "Loading audio..." : "Start soundscape"}
        >
          {isLoading ? (
            <span className="flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading sounds...
            </span>
          ) : (
            "Start Soundscape"
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div
            className="mt-4 px-6 py-3 bg-warm/10 dark:bg-dark-warm/10
                       border border-warm/30 dark:border-dark-warm/30 rounded-lg"
          >
            <p className="text-warm dark:text-dark-warm text-sm">{error}</p>
          </div>
        )}

        {/* Info Text */}
        <p className="text-text-secondary dark:text-dark-text-secondary text-sm max-w-md">
          Click to enable audio playback. Your browser requires user interaction to play sounds.
        </p>
      </div>
    </div>
  );
}
