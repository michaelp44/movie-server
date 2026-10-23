import { weddingConfig } from "@/lib/wedding-config";

export type WeddingMessageKind = "invitation" | "reminder" | "event_details" | "table_assignment" | "thank_you";

export function weddingMessageMediaUrl(kind: WeddingMessageKind): string | null {
  return kind === "invitation"
    ? `${weddingConfig.domain.replace(/\/$/, "")}/images/wedding-invitation.jpg`
    : null;
}

export function whatsappRecipient(normalizedPhone: string): string | null {
  const digits = normalizedPhone.replace(/\D/g, "");
  return /^972\d{8,9}$/.test(digits) ? digits : null;
}

export function personalizedRsvpUrl(token: string): string {
  return `${weddingConfig.domain.replace(/\/$/, "")}/g/${encodeURIComponent(token)}?next=rsvp`;
}

export function greetingNames(displayName: string): string {
  const name = displayName.trim();
  if (!name || /^(משפחת|המשפחה|חברים|אורחים)(?:\s|$)/u.test(name)) return "לכם";

  const firstName = (part: string) => {
    const words = part.trim().split(/\s+/u);
    return words[0] === "בת" && words[1] === "אל" ? "בת אל" : words[0];
  };
  const couple = name.match(/^(.+?)\s+ו(\S+)/u);
  if (couple) return `${firstName(couple[1])} ו${firstName(couple[2])}`;
  return firstName(name);
}

/** Treat Latin-script invitation names as English, while keeping Hebrew names in Hebrew. */
export function messageLanguage(displayName: string): "he" | "en" {
  return /[\u0590-\u05FF]/u.test(displayName) || !/[A-Za-z]/u.test(displayName) ? "he" : "en";
}

function englishGreetingNames(displayName: string): string {
  const name = displayName.trim();
  if (!name || /^(?:the\s+)?(?:family|guests|friends)\b/i.test(name)) return "everyone";
  return name
    .split(/\s+(?:and|&|\+)\s*/i)
    .map((person) => person.trim().replace(/^[,\s]+|[,\s]+$/g, "").split(/\s+/u)[0])
    .filter(Boolean)
    .join(" & ") || "there";
}

export function weddingMessage(input: {
  kind: WeddingMessageKind;
  displayName: string;
  secureToken: string;
  tableNumber?: string | null;
}): string {
  if (messageLanguage(input.displayName) === "en") {
    const greeting = `Hi ${englishGreetingNames(input.displayName)} ❤️`;
    const link = personalizedRsvpUrl(input.secureToken);
    if (input.kind === "reminder") {
      return `${greeting}\nJust a little reminder — please let us know if you can join us on ${weddingConfig.displayDate}.\nRSVP here: ${link}\nShoval & Michael`;
    }
    if (input.kind === "event_details") {
      return `${greeting}\nWe can't wait to celebrate with you!\n${weddingConfig.displayDate} · ${weddingConfig.timeline.items[0]?.time ?? "19:30"}\n${weddingConfig.venue.name}\nEvent details: ${link}`;
    }
    if (input.kind === "table_assignment") {
      const table = input.tableNumber ? `Your table: ${input.tableNumber}\n` : "";
      return `${greeting}\nThe big day is here! 🥂\n${table}Directions and event details: ${link}\nShoval & Michael`;
    }
    if (input.kind === "thank_you") {
      return `${greeting}\nThank you for celebrating with us and making the evening unforgettable ❤️\nShoval & Michael\n${weddingConfig.domain}`;
    }
    return `${greeting}\nShoval & Michael are getting married on ${weddingConfig.displayDate}, and we'd love to celebrate with you! 🥂\nPlease RSVP and find all event details here: ${link}\nCan't wait to celebrate with you ❤️`;
  }

  const greeting = `היי ${greetingNames(input.displayName)} ❤️`;
  const link = personalizedRsvpUrl(input.secureToken);
  if (input.kind === "reminder") {
    return `${greeting}\nרק תזכורת קטנה — נשמח לדעת אם תגיעו לחתונה שלנו ב־${weddingConfig.displayDate}.\nלאישור הגעה: ${link}\nשובל ומיכאל`;
  }
  if (input.kind === "event_details") {
    return `${greeting}\nמחכים לכם ממש בקרוב!\n${weddingConfig.displayDate} · ${weddingConfig.timeline.items[0]?.time ?? "19:30"}\n${weddingConfig.venue.name}\nWaze: ${weddingConfig.maps.waze}\nכל הפרטים: ${link}`;
  }
  if (input.kind === "table_assignment") {
    const table = input.tableNumber ? `השולחן שלכם: ${input.tableNumber}\n` : "";
    return `${greeting}\nהיום חוגגים! 🥂\n${table}ניווט ופרטי האירוע: ${link}\nשובל ומיכאל`;
  }
  if (input.kind === "thank_you") {
    return `${greeting}\nתודה שחגגתם איתנו והפכתם את הערב שלנו לבלתי נשכח ❤️\nשובל ומיכאל\n${weddingConfig.domain}`;
  }
  return `${greeting}\nשובל ומיכאל מתחתנים ב־${weddingConfig.displayDate}, ונשמח מאוד לחגוג איתכם! 🥂\nלאישור הגעה ולכל פרטי האירוע: ${link}\nמחכים לכם ❤️`;
}
