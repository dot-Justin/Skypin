"use client";

import type { WeatherData } from "@/types/weather";
import { formatBiomeForDisplay } from "@/lib/biomeUtils";

interface WeatherDisplayProps {
  data: WeatherData;
}

export default function WeatherDisplay({ data }: WeatherDisplayProps) {
  const { location, current, biome } = data;

  // Format the local time
  const localTime = new Date(location.localtime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="w-full max-w-2xl">
      <div className="space-y-8">
        {/* Location Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-serif mb-2">
            {location.name}
          </h1>
          <p className="text-text-secondary dark:text-dark-text-secondary text-lg">
            {location.region && `${location.region}, `}{location.country} • {formatBiomeForDisplay(biome.type)}
          </p>
        </div>

        {/* Main Weather Info */}
        <div className="flex flex-col items-center gap-6">
          {/* Temperature */}
          <div className="text-center">
            <div className="text-7xl md:text-8xl font-serif">
              {Math.round(current.temp_f)}°
            </div>
            <div className="text-text-secondary dark:text-dark-text-secondary text-xl">
              {Math.round(current.temp_c)}°C
            </div>
          </div>

          {/* Condition Text */}
          <p className="text-2xl font-serif">{current.condition.text}</p>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-accent-secondary/20 dark:border-dark-accent-secondary/20">
          <div className="text-center">
            <p className="text-text-secondary dark:text-dark-text-secondary text-sm mb-1">Feels Like</p>
            <p className="text-xl font-medium">{Math.round(current.feelslike_f)}°F</p>
          </div>
          <div className="text-center">
            <p className="text-text-secondary dark:text-dark-text-secondary text-sm mb-1">Humidity</p>
            <p className="text-xl font-medium">{current.humidity}%</p>
          </div>
          <div className="text-center">
            <p className="text-text-secondary dark:text-dark-text-secondary text-sm mb-1">Wind</p>
            <p className="text-xl font-medium">{Math.round(current.wind_mph)} mph</p>
          </div>
          <div className="text-center">
            <p className="text-text-secondary dark:text-dark-text-secondary text-sm mb-1">Local Time</p>
            <p className="text-xl font-medium">{localTime}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
