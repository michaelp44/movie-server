import { describe, expect, it } from "vitest";
import { isWeddingInForecastRange, weatherCodeLabel } from "@/lib/weather/open-meteo";

describe("wedding weather", () => {
  it("translates common WMO weather codes", () => {
    expect(weatherCodeLabel(0)).toBe("שמיים בהירים");
    expect(weatherCodeLabel(3)).toBe("מעונן חלקית");
    expect(weatherCodeLabel(61)).toBe("גשום");
    expect(weatherCodeLabel(95)).toBe("סופות מקומיות");
  });

  it("only enables the forecast during wedding week", () => {
    expect(isWeddingInForecastRange(new Date("2026-12-04T20:00:00+02:00"))).toBe(true);
    expect(isWeddingInForecastRange(new Date("2026-11-20T20:00:00+02:00"))).toBe(false);
    expect(isWeddingInForecastRange(new Date("2026-12-11T00:00:00+02:00"))).toBe(false);
  });
});
