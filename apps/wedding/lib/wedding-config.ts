export type DietaryTag = "vegan" | "vegetarian" | "gluten-free";

export type MenuItem = {
  name: string;
  description: string;
  image: {
    src: string;
    alt: string;
  } | null;
  dietaryTags: DietaryTag[];
};

export type MenuCategory = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  items: MenuItem[];
};

export type TimelineIcon = "doors" | "ceremony" | "dinner" | "party";

export type TimelineItem = {
  time: string;
  title: string;
  description: string;
  icon: TimelineIcon;
  featured?: boolean;
};

export type StoryEntry = {
  id: string;
  date: string;
  title: string;
  story: string;
  image: {
    src: string;
    alt: string;
  } | null;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type BankTransferDetails = {
  beneficiary: string;
  bank: string;
  branch: string;
  account: string;
} | null;

export type GuestNavigationItem = {
  href: string;
  label: string;
  shortLabel?: string;
};

export type WeatherForecast = {
  condition: string;
  highCelsius: number;
  lowCelsius: number;
  precipitationChance?: number;
  updatedAt?: string;
};

export type WeddingConfig = {
  couple: {
    bride: string;
    groom: string;
    brideHebrew: string;
    groomHebrew: string;
  };
  date: string;
  dateTime: string;
  endDateTime: string;
  displayDate: string;
  timezone: string;
  domain: string;
  venue: {
    name: string;
    address: string;
    parking: string;
    notes: string;
    isPlaceholder: boolean;
  };
  maps: {
    waze: string;
    googleMaps: string;
  };
  gift: {
    bitUrl: string;
    bitPhone: string;
    introduction: string;
    bankTransfer: BankTransferDetails;
    isPlaceholder: boolean;
  };
  calendar: {
    title: string;
    description: string;
    icsPath: string;
    uid: string;
  };
  weather: {
    enabled: boolean;
    locationLabel: string;
    prominentDaysBefore: number;
    provider: "weatherapi" | "open-meteo" | null;
    isPlaceholder: boolean;
  };
  timeline: {
    isPlaceholder: boolean;
    note: string;
    items: TimelineItem[];
  };
  menu: {
    isPlaceholder: boolean;
    note: string;
    categories: MenuCategory[];
  };
  story: {
    isPlaceholder: boolean;
    introduction: string;
    entries: StoryEntry[];
  };
  faq: {
    isPlaceholder: boolean;
    items: FaqItem[];
  };
  navigation: GuestNavigationItem[];
};

/**
 * Public, editable wedding content belongs here. Placeholder flags are
 * intentionally explicit so unfinished details cannot be mistaken for final data.
 */
export const weddingConfig: WeddingConfig = {
  couple: {
    bride: "Shoval",
    groom: "Michael",
    brideHebrew: "שובל",
    groomHebrew: "מיכאל",
  },
  date: "2026-12-10",
  dateTime: "2026-12-10T19:00:00+02:00",
  endDateTime: "2026-12-11T02:00:00+02:00",
  displayDate: "10.12.2026",
  timezone: "Asia/Jerusalem",
  domain: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wedding.my-rem.com",
  venue: {
    name: "5.91 — אירועים על הים",
    address: "שדרות עובד בן עמי 2, נתניה",
    parking: "לפי מידע האולם קיימת חניה בשפע במתחם ובסביבתו.",
    notes: "המתחם נמצא על קו החוף של נתניה. מומלץ לפתוח ניווט לפני היציאה.",
    isPlaceholder: false,
  },
  maps: {
    waze: "https://www.waze.com/ul?q=5.91%20%D7%A9%D7%93%D7%A8%D7%95%D7%AA%20%D7%A2%D7%95%D7%91%D7%93%20%D7%91%D7%9F%20%D7%A2%D7%9E%D7%99%202%20%D7%A0%D7%AA%D7%A0%D7%99%D7%94&navigate=yes",
    googleMaps: "https://www.google.com/maps/search/?api=1&query=5.91%20%D7%A9%D7%93%D7%A8%D7%95%D7%AA%20%D7%A2%D7%95%D7%91%D7%93%20%D7%91%D7%9F%20%D7%A2%D7%9E%D7%99%202%20%D7%A0%D7%AA%D7%A0%D7%99%D7%94",
  },
  gift: {
    bitUrl: process.env.NEXT_PUBLIC_BIT_URL ?? "",
    bitPhone: "0503062269",
    introduction:
      "הנוכחות שלכם היא המתנה הכי משמחת בשבילנו. למי שבכל זאת רוצה לפנק, אפשר לעשות זאת כאן בנחת.",
    bankTransfer: null,
    isPlaceholder: false,
  },
  calendar: {
    title: "החתונה של שובל ומיכאל",
    description:
      "מחכים לחגוג איתכם. כל העדכונים לקראת האירוע מחכים באתר החתונה.",
    icsPath: "/api/calendar",
    uid: "shoval-michael-2026@wedding.my-rem.com",
  },
  weather: {
    enabled: false,
    locationLabel: "נתניה, קו החוף",
    prominentDaysBefore: 7,
    provider: null,
    isPlaceholder: true,
  },
  timeline: {
    isPlaceholder: true,
    note: "השעות עדיין לדוגמה ויעודכנו לאחר סגירת הלו״ז הסופי.",
    items: [
      {
        time: "19:00",
        title: "קבלת פנים",
        description: "דרינק ראשון, מוזיקה טובה והזמן שלנו להתחבק עם כולם.",
        icon: "doors",
      },
      {
        time: "20:30",
        title: "החופה",
        description: "הרגע שבשבילו התכנסנו — נשמח שתהיו איתנו כמה דקות קודם.",
        icon: "ceremony",
        featured: true,
      },
      {
        time: "21:00",
        title: "ארוחת ערב",
        description: "מתיישבים, טועמים ומרימים כוס לחיים.",
        icon: "dinner",
      },
      {
        time: "22:00",
        title: "המסיבה מתחילה",
        description: "עוברים לרחבה ולא מפסיקים עד שכואבות הרגליים.",
        icon: "party",
      },
    ],
  },
  menu: {
    isPlaceholder: true,
    note: "זהו תפריט הדגמה. המנות, התיאורים והתמונות יוחלפו בתפריט הסופי של האולם.",
    categories: [
      {
        id: "reception",
        title: "קבלת פנים",
        eyebrow: "פותחים את הערב",
        description: "מנות קטנות שמוגשות ברחבה לצד הקוקטייל הראשון.",
        items: [
          {
            name: "קריספי ארטישוק ירושלמי",
            description: "קרם לימון כבוש, עשבי תיבול ושמן זית מקומי.",
            image: null,
            dietaryTags: ["vegan", "gluten-free"],
          },
          {
            name: "ברוסקטת עגבניות חרוכות",
            description: "לחם מחמצת, עגבניות צבעוניות, בזיליקום ולאבנה.",
            image: null,
            dietaryTags: ["vegetarian"],
          },
          {
            name: "דג ים על הפלנצ׳ה",
            description: "איולי לימון, סלסת פלפל ירוק ועשבים רעננים.",
            image: null,
            dietaryTags: ["gluten-free"],
          },
        ],
      },
      {
        id: "starters",
        title: "פתיחים ומנות ראשונות",
        eyebrow: "למרכז השולחן",
        description: "צלחות עונתיות לחלוקה, שמגיעות לשולחן בקצב נינוח.",
        items: [
          {
            name: "סלט עלים וחסה פריכה",
            description: "אגס, שקדים קלויים, ויניגרט הדרים וגבינה כחולה בצד.",
            image: null,
            dietaryTags: ["vegetarian", "gluten-free"],
          },
          {
            name: "קרפצ׳יו סלק צלוי",
            description: "טחינה לבנה, פיסטוק, נענע וסילאן עדין.",
            image: null,
            dietaryTags: ["vegan", "gluten-free"],
          },
          {
            name: "טרטר דג ים",
            description: "מלפפון, אבוקדו, צ׳ילי עדין ושמן כוסברה.",
            image: null,
            dietaryTags: ["gluten-free"],
          },
        ],
      },
      {
        id: "mains",
        title: "עיקריות",
        eyebrow: "הבחירה שלכם",
        description: "מבחר מנות עיקריות שיוגשו עם תוספות עונתיות.",
        items: [
          {
            name: "פילה בקר בצלייה ארוכה",
            description: "קרם תפוחי אדמה, ירקות שורש ורוטב יין אדום.",
            image: null,
            dietaryTags: ["gluten-free"],
          },
          {
            name: "דג לבן צלוי",
            description: "פריקה ירוקה, שומר, לימון ועשבי גינה.",
            image: null,
            dietaryTags: [],
          },
          {
            name: "סטייק כרובית",
            description: "קרם שקדים, עדשים שחורות, עגבניות צלויות וסלסה ורדה.",
            image: null,
            dietaryTags: ["vegan", "gluten-free"],
          },
        ],
      },
      {
        id: "desserts",
        title: "קינוחים",
        eyebrow: "משהו מתוק",
        description: "קינוחים קטנים לרחבה ולשולחן הקפה.",
        items: [
          {
            name: "פבלובה אישית",
            description: "קרם וניל, פירות עונה וקולי פטל.",
            image: null,
            dietaryTags: ["vegetarian", "gluten-free"],
          },
          {
            name: "שוקולד, שמן זית ומלח ים",
            description: "קרם שוקולד מריר, קראמבל קקאו ואגוזי לוז.",
            image: null,
            dietaryTags: ["vegan"],
          },
        ],
      },
    ],
  },
  story: {
    isPlaceholder: true,
    introduction:
      "הפרקים כאן הם מבנה לדוגמה לסיפור שלנו. בקרוב נוסיף את הרגעים, המילים והתמונות שבאמת שייכים לנו.",
    entries: [
      {
        id: "how-we-met",
        date: "הפרק הראשון",
        title: "איך הכרנו",
        story:
          "כאן ייכנס הסיפור על המפגש הראשון שלנו — איפה היינו, מי שם לב למי, ומה גרם לנו לרצות להמשיך לדבר.",
        image: null,
      },
      {
        id: "first-date",
        date: "קצת אחר כך",
        title: "הדייט הראשון",
        story:
          "המקום, השיחה שנמשכה יותר מהמתוכנן והפרט הקטן ששנינו עדיין זוכרים. את הסיפור המלא נוסיף ממש בקרוב.",
        image: null,
      },
      {
        id: "first-trip",
        date: "ההרפתקה הראשונה",
        title: "הטיול הראשון",
        story:
          "כאן נספר על הפעם הראשונה שארזנו יחד, יצאנו מהשגרה וגילינו שאנחנו צוות לא רע בכלל.",
        image: null,
      },
      {
        id: "home",
        date: "בונים בית",
        title: "עוברים לגור ביחד",
        story:
          "הארגזים, הבחירות הקטנות והחיים שהתחילו להרגיש כמו הבית המשותף שלנו.",
        image: null,
      },
      {
        id: "proposal",
        date: "הרגע הגדול",
        title: "ההצעה",
        story:
          "איך זה קרה, מה תוכנן מראש ומה השתבש בדרך — כל הפרטים והתמונה האהובה עלינו יתווספו כאן.",
        image: null,
      },
      {
        id: "wedding",
        date: "10.12.2026",
        title: "החתונה",
        story:
          "הפרק הבא נכתב יחד איתכם. מחכים שתהיו שם, תרקדו, תתרגשו ותהפכו את היום הזה לזיכרון שלנו.",
        image: null,
      },
    ],
  },
  faq: {
    isPlaceholder: true,
    items: [
      {
        question: "יש חניה?",
        answer: "כן. לפי המידע שמפרסם 5.91 קיימת חניה בשפע במתחם ובסביבתו.",
      },
      {
        question: "האירוע בפנים או בחוץ?",
        answer: "5.91 נמצא ממש מול הים וכולל חללים פתוחים לצד אולם מקורה עם קירוי זכוכית. התכנון המדויק לערב שלנו יעודכן קרוב למועד בהתאם למזג האוויר.",
      },
      {
        question: "יש מנות טבעוניות וללא גלוטן?",
        answer: "בהחלט. בתפריט יסומנו המנות המתאימות, וצוות האולם ישמח לסייע גם בערב עצמו.",
      },
      {
        question: "מה ללבוש?",
        answer: "חגיגי, אלגנטי ובעיקר משהו שנעים לרקוד איתו. אם האירוע יהיה בחוץ, נוסיף כאן המלצה בהתאם למזג האוויר.",
      },
      {
        question: "יש הסעות?",
        answer: "פרטי ההסעות עדיין בבדיקה. אם יהיו הסעות מאורגנות, המסלולים והשעות יופיעו כאן.",
      },
      {
        question: "עד איזו שעה חוגגים?",
        answer: "עד שנגמר הכוח — והלו״ז הסופי של הערב יופיע בעמוד הלו״ז.",
      },
    ],
  },
  navigation: [
    { href: "/", label: "הבית" },
    { href: "/table", label: "השולחן שלי", shortLabel: "שולחן" },
    { href: "/menu", label: "התפריט" },
    { href: "/schedule", label: "לו״ז" },
    { href: "/story", label: "הסיפור שלנו" },
    { href: "/photos", label: "תמונות" },
    { href: "/info", label: "מידע שימושי", shortLabel: "מידע" },
    { href: "/gift", label: "מתנה" },
  ],
};

export type CalendarEvent = {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  url: string;
  timezone: string;
  uid: string;
};

export function getCalendarEvent(): CalendarEvent {
  const venueLocation = [weddingConfig.venue.name, weddingConfig.venue.address]
    .filter(Boolean)
    .join(", ");

  return {
    title: weddingConfig.calendar.title,
    description: `${weddingConfig.calendar.description}\n${weddingConfig.domain}`,
    start: weddingConfig.dateTime,
    end: weddingConfig.endDateTime,
    location: venueLocation,
    url: weddingConfig.domain,
    timezone: weddingConfig.timezone,
    uid: weddingConfig.calendar.uid,
  };
}

function toGoogleCalendarDate(value: string) {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function getGoogleCalendarUrl() {
  const event = getCalendarEvent();
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set(
    "dates",
    `${toGoogleCalendarDate(event.start)}/${toGoogleCalendarDate(event.end)}`,
  );
  url.searchParams.set("details", event.description);
  url.searchParams.set("location", event.location);
  url.searchParams.set("ctz", event.timezone);

  return url.toString();
}

function escapeIcsValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

export function buildCalendarIcs() {
  const event = getCalendarEvent();
  const start = toGoogleCalendarDate(event.start);
  const end = toGoogleCalendarDate(event.end);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Shoval and Michael//Wedding//HE",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    "DTSTAMP:20260101T000000Z",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsValue(event.title)}`,
    `DESCRIPTION:${escapeIcsValue(event.description)}`,
    `LOCATION:${escapeIcsValue(event.location)}`,
    `URL:${escapeIcsValue(event.url)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
