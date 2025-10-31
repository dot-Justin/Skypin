"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import WeatherDisplay from "@/components/WeatherDisplay";
import { getWeather } from "@/lib/weather";
import type { WeatherData } from "@/types/weather";

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getWeather(query);
      setWeatherData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
      setWeatherData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-12">
        {/* App Header */}
        <div className="text-center">
          <h1 className="text-6xl md:text-7xl font-serif mb-4">Skypin</h1>
          <p className="text-text-secondary dark:text-dark-text-secondary text-lg">Weather for your mood</p>
        </div>

        {/* Search Bar */}
        <div className="flex justify-center">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center">
            <div className="inline-block animate-pulse text-text-secondary dark:text-dark-text-secondary">
              Loading weather data...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center">
            <div className="inline-block px-6 py-3 bg-warm/10 dark:bg-dark-warm/10 border border-warm/30 dark:border-dark-warm/30 rounded-lg">
              <p className="text-warm dark:text-dark-warm">{error}</p>
            </div>
          </div>
        )}

        {/* Weather Display */}
        {weatherData && !isLoading && (
          <div className="flex justify-center animate-in fade-in duration-500">
            <WeatherDisplay data={weatherData} />
          </div>
        )}

        {/* Empty State */}
        {!weatherData && !isLoading && !error && (
          <div className="text-center text-text-secondary dark:text-dark-text-secondary">
            <p>Enter a location to see the current weather</p>
          </div>
        )}
      </div>
    </main>
  );
}
