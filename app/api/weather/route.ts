import { NextRequest, NextResponse } from "next/server";
import type {
  WeatherData,
  GeocodingResponse,
  OpenMeteoForecast,
} from "@/types/weather";
import { getWeatherDescription } from "@/lib/wmoCode";
import { getBiome } from "@/lib/biomeDetector";

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

// Convert km/h to mph
function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    // Step 1: Geocode the query to get coordinates
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=1&language=en&format=json`;

    const geocodingResponse = await fetch(geocodingUrl);

    if (!geocodingResponse.ok) {
      return NextResponse.json(
        { error: "Failed to geocode location" },
        { status: geocodingResponse.status }
      );
    }

    const geocodingData: GeocodingResponse = await geocodingResponse.json();

    if (!geocodingData.results || geocodingData.results.length === 0) {
      return NextResponse.json(
        { error: "Location not found. Please try a different search term." },
        { status: 404 }
      );
    }

    const location = geocodingData.results[0];

    // Step 2: Detect biome for the location using MODIS satellite data grid
    const biome = getBiome(location.latitude, location.longitude);

    // Step 3: Fetch weather data for the coordinates
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;

    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch weather data" },
        { status: weatherResponse.status }
      );
    }

    const weatherData: OpenMeteoForecast = await weatherResponse.json();

    // Step 4: Transform to our unified WeatherData format
    const transformedData: WeatherData = {
      location: {
        name: location.name,
        region: location.admin1 || "",
        country: location.country,
        localtime: weatherData.current.time,
      },
      current: {
        temp_c: Math.round(weatherData.current.temperature_2m),
        temp_f: Math.round(celsiusToFahrenheit(weatherData.current.temperature_2m)),
        condition: {
          text: getWeatherDescription(weatherData.current.weather_code),
          code: weatherData.current.weather_code,
        },
        wind_kph: Math.round(weatherData.current.wind_speed_10m),
        wind_mph: Math.round(kmhToMph(weatherData.current.wind_speed_10m)),
        wind_dir: weatherData.current.wind_direction_10m,
        humidity: weatherData.current.relative_humidity_2m,
        feelslike_c: Math.round(weatherData.current.apparent_temperature),
        feelslike_f: Math.round(celsiusToFahrenheit(weatherData.current.apparent_temperature)),
      },
      biome: {
        type: biome,
        coordinates: {
          lat: location.latitude,
          lon: location.longitude,
        },
      },
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("Open-Meteo API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
