import { describe, expect, it } from "vitest";
import { greetingNames, messageLanguage, personalizedRsvpUrl, weddingMessage, weddingMessageMediaUrl, whatsappRecipient } from "@/lib/rsvp/messages";

describe("RSVP WhatsApp messages", () => {
  it("normalizes a canonical Israeli phone for WhatsApp", () => {
    expect(whatsappRecipient("+972501234567")).toBe("972501234567");
    expect(whatsappRecipient("0501234567")).toBeNull();
  });

  it("builds a personalized invitation without exposing a phone number", () => {
    const body = weddingMessage({ kind: "invitation", displayName: "דניאל ונועה", secureToken: "safe_token" });
    expect(body).toContain("דניאל ונועה");
    expect(body).toContain(personalizedRsvpUrl("safe_token"));
    expect(body).not.toContain("050");
  });

  it("sends English copy when the invitation name is written in Latin characters", () => {
    expect(messageLanguage("Dana Shenhar")).toBe("en");
    const body = weddingMessage({ kind: "invitation", displayName: "Dana Shenhar", secureToken: "safe_token" });
    expect(body).toContain("Hi Dana ❤️");
    expect(body).toContain("Shoval & Michael are getting married");
    expect(body).toContain(personalizedRsvpUrl("safe_token"));
    expect(body).not.toContain("היי");
  });

  it("greets English-speaking couples by first names and keeps Hebrew names in Hebrew", () => {
    expect(weddingMessage({ kind: "invitation", displayName: "Dana Shenhar & Tom Alon", secureToken: "safe_token" })).toContain("Hi Dana & Tom ❤️");
    expect(messageLanguage("דנה Shenhar")).toBe("he");
    expect(weddingMessage({ kind: "invitation", displayName: "דנה לוי", secureToken: "safe_token" })).toContain("היי דנה ❤️");
  });

  it("attaches the invitation image only to the initial invitation", () => {
    expect(weddingMessageMediaUrl("invitation")).toBe("https://wedding.my-rem.com/images/wedding-invitation.jpg");
    expect(weddingMessageMediaUrl("reminder")).toBeNull();
    expect(weddingMessageMediaUrl("event_details")).toBeNull();
  });

  it.each([
    ["גבריאל פוקשמנסקי", "גבריאל"],
    ["אריק ומעיין פוקשנסקי", "אריק ומעיין"],
    ["דידי ריינר ואוהד בר ישי", "דידי ואוהד"],
    ["Alisa Kalashnikova", "Alisa"],
    ["משפחת כהן", "לכם"],
    ["בת אל מלכה", "בת אל"],
  ])("addresses %s as %s without a surname", (displayName, expected) => {
    expect(greetingNames(displayName)).toBe(expected);
    const greeting = messageLanguage(displayName) === "en" ? `Hi ${expected} ❤️` : `היי ${expected} ❤️`;
    for (const kind of ["invitation", "reminder", "event_details", "table_assignment", "thank_you"] as const) {
      expect(weddingMessage({ kind, displayName, secureToken: "safe_token" })).toContain(greeting);
    }
  });

  it("routes personalized RSVP links through guest identification", () => {
    expect(personalizedRsvpUrl("safe_token")).toBe(
      "https://wedding.my-rem.com/g/safe_token?next=rsvp",
    );
  });
});
