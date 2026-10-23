import { describe, expect, it } from "vitest";

import { parseRsvpDetails, rsvpDetailsSchema, rsvpDetailsSummary, type RsvpDetails } from "../lib/rsvp/details";

describe("RSVP guest details", () => {
  const details: RsvpDetails = {
    adults: 2,
    children: 1,
    infants: 0,
    transport: "yes",
    dietary: ["vegetarian", "gluten_free"],
    allergyNote: "אלרגיה לאגוזים",
  };

  it("accepts structured meal and transport preferences", () => {
    expect(rsvpDetailsSchema.parse(details)).toEqual(details);
    expect(rsvpDetailsSummary(details)).toContain("מבקשים הסעה");
    expect(rsvpDetailsSummary(details)).toContain("ללא גלוטן");
  });

  it("accepts more attendees than the original invitation estimate", () => {
    expect(rsvpDetailsSchema.safeParse({ ...details, adults: 31, children: 12 }).success).toBe(true);
  });

  it("does not accept unexpected dietary values or oversized notes", () => {
    expect(rsvpDetailsSchema.safeParse({ ...details, dietary: ["other"] }).success).toBe(false);
    expect(rsvpDetailsSchema.safeParse({ ...details, allergyNote: "x".repeat(301) }).success).toBe(false);
  });

  it("ignores malformed persisted details", () => {
    expect(parseRsvpDetails(null)).toBeNull();
    expect(parseRsvpDetails({ adults: -1 })).toBeNull();
  });
});
