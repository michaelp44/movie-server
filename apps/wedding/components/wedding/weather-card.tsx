import { CloudSun, Droplets, MapPin, ThermometerSun } from "lucide-react";
import { weddingConfig, type WeatherForecast } from "@/lib/wedding-config";

type WeatherCardProps = {
  forecast?: WeatherForecast | null;
  now?: Date;
};

function daysUntilWedding(now: Date) {
  const wedding = new Date(weddingConfig.dateTime);
  return Math.ceil((wedding.getTime() - now.getTime()) / 86_400_000);
}

export function WeatherCard({ forecast = null, now = new Date() }: WeatherCardProps) {
  const daysAway = daysUntilWedding(now);
  const shouldPromote = daysAway >= 0 && daysAway <= weddingConfig.weather.prominentDaysBefore;

  return (
    <section
      aria-labelledby="weather-heading"
      className={`overflow-hidden rounded-[1.75rem] border p-6 sm:p-8 ${
        shouldPromote
          ? "border-[#ae8951]/30 bg-[#eee3cf] shadow-[0_18px_60px_rgba(65,49,29,0.08)]"
          : "border-stone-900/9 bg-white/65"
      }`}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#96713e]">לקראת הערב</p>
          <h2 id="weather-heading" className="mt-2 font-serif text-3xl font-medium tracking-[-0.025em]">
            מזג האוויר בחתונה
          </h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
            <MapPin aria-hidden="true" size={15} />
            {weddingConfig.weather.locationLabel}
          </p>
        </div>
        <span className="grid size-13 shrink-0 place-items-center rounded-full bg-[#eee3cf] text-[#89683a]">
          <CloudSun aria-hidden="true" size={25} strokeWidth={1.5} />
        </span>
      </div>

      {weddingConfig.weather.enabled && forecast ? (
        <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-5 border-t border-stone-900/9 pt-6">
          <div>
            <p className="text-lg font-semibold text-stone-900">{forecast.condition}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <ThermometerSun aria-hidden="true" size={16} />
                {forecast.lowCelsius}°–{forecast.highCelsius}°
              </span>
              {forecast.precipitationChance !== undefined ? (
                <span className="inline-flex items-center gap-1.5">
                  <Droplets aria-hidden="true" size={16} />
                  {forecast.precipitationChance}% סיכוי לגשם
                </span>
              ) : null}
            </div>
          </div>
          <p className="font-serif text-5xl font-medium tabular-nums">{forecast.highCelsius}°</p>
        </div>
      ) : (
        <p className="mt-6 border-t border-stone-900/9 pt-5 text-sm leading-7 text-stone-600">
          התחזית המדויקת תופיע כאן בשבוע שלפני החתונה, יחד עם המלצה מה כדאי להביא.
        </p>
      )}
    </section>
  );
}
