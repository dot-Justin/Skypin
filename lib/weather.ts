import type { WeatherData } from "@/types/weather";

export async function getWeather(query: string): Promise<WeatherData> {
  const response = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch weather data");
  }

  return response.json();
}
