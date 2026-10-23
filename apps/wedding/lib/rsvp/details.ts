import { z } from "zod";

export const dietaryOptions = [
  ["vegetarian", "צמחוני"],
  ["vegan", "טבעוני"],
  ["gluten_free", "ללא גלוטן"],
  ["kosher", "כשרות מהודרת"],
] as const;

const dietarySchema = z.enum(dietaryOptions.map(([value]) => value));
const dietaryCountsSchema = z.object({
  vegetarian: z.coerce.number().int().min(0).max(100),
  vegan: z.coerce.number().int().min(0).max(100),
  gluten_free: z.coerce.number().int().min(0).max(100),
  kosher: z.coerce.number().int().min(0).max(100),
}).partial();

export const rsvpDetailsSchema = z.object({
  adults: z.coerce.number().int().min(0),
  children: z.coerce.number().int().min(0),
  infants: z.coerce.number().int().min(0),
  transport: z.preprocess(
    (value) => value === true ? "yes" : value === false ? "no" : value,
    z.enum(["yes", "no", "unknown"]),
  ),
  dietary: z.array(dietarySchema).max(dietaryOptions.length),
  dietaryCounts: dietaryCountsSchema.optional(),
  allergyNote: z.string().trim().max(300),
});

export type RsvpDetails = z.infer<typeof rsvpDetailsSchema>;

export function parseRsvpDetails(value: unknown): RsvpDetails | null {
  const parsed = rsvpDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function rsvpDetailsSummary(details: RsvpDetails, legacyDietaryCount = 0): string[] {
  const people = [
    details.adults ? `${details.adults} ${details.adults === 1 ? "מבוגר/ת" : "מבוגרים"}` : null,
    details.children ? `${details.children} ילדים (4–13)` : null,
    details.infants ? `${details.infants} ילדים עד גיל 3` : null,
  ].filter((value): value is string => Boolean(value));
  return [
    people.join(" · "),
    details.transport === "yes"
      ? "מבקשים הסעה"
      : details.transport === "no"
        ? "לא מבקשים הסעה"
        : "עדיין לא יודעים אם נצטרך הסעה",
    ...details.dietary.map((value) => {
      const label = dietaryOptions.find(([key]) => key === value)?.[1] ?? value;
      const count = details.dietaryCounts?.[value] ?? legacyDietaryCount;
      return count > 0 ? `${label}: ${count}` : label;
    }),
    details.allergyNote ? `אלרגיות / מידע נוסף: ${details.allergyNote}` : null,
  ].filter((value): value is string => Boolean(value));
}
