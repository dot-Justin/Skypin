import { BiomeType } from "../lib/biomeDetector";

// Open-Meteo Geocoding API Response
export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  country: string;
  admin1?: string;
  admin2?: string;
  country_code: string;
  feature_code?: string;
}

export interface GeocodingResponse {
  results?: GeocodingResult[];
}

// Open-Meteo Forecast API Response
export interface OpenMeteoForecast {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  timezone_abbreviation: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  current_units: {
    temperature_2m: string;
    relative_humidity_2m: string;
    apparent_temperature: string;
    weather_code: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
}

// Unified Weather Data for the app
export interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    localtime: string;
  };
  current: {
    temp_f: number;
    temp_c: number;
    condition: {
      text: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    wind_dir: number;
    humidity: number;
    feelslike_f: number;
    feelslike_c: number;
  };
  biome: {
    type: BiomeType;
    coordinates: {
      lat: number;
      lon: number;
    };
  };
}

export interface WeatherError {
  error: string;
}
