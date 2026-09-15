import "server-only";
import { weddingConfig, type WeatherForecast } from "@/lib/wedding-config";

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
};

export function weatherCodeLabel(code: number) {
  if (code === 0) return "שמיים בהירים";
  if (code <= 3) return "מעונן חלקית";
  if (code <= 48) return "ערפל קל";
  if (code <= 57) return "טפטוף";
  if (code <= 67) return "גשום";
  if (code <= 77) return "משקעים קרים";
  if (code <= 82) return "ממטרים";
  return "סופות מקומיות";
}

export function isWeddingInForecastRange(now: Date) {
  const wedding = new Date(weddingConfig.dateTime);
  const days = (wedding.getTime() - now.getTime()) / 86_400_000;
  return days >= 0 && days <= weddingConfig.weather.prominentDaysBefore;
}

export async function getWeddingForecast(now = new Date()): Promise<WeatherForecast | null> {
  if (!weddingConfig.weather.enabled || !isWeddingInForecastRange(now)) return null;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", "32.3215");
  url.searchParams.set("longitude", "34.8532");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", weddingConfig.timezone);
  url.searchParams.set("forecast_days", "8");

  try {
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) return null;
    const payload = await response.json() as { daily?: OpenMeteoDaily };
    const daily = payload.daily;
    const index = daily?.time?.indexOf(weddingConfig.date) ?? -1;
    const code = daily?.weather_code?.[index];
    const high = daily?.temperature_2m_max?.[index];
    const low = daily?.temperature_2m_min?.[index];
    if (index < 0 || code === undefined || high === undefined || low === undefined) return null;
    return {
      condition: weatherCodeLabel(code),
      highCelsius: Math.round(high),
      lowCelsius: Math.round(low),
      precipitationChance: daily?.precipitation_probability_max?.[index],
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
