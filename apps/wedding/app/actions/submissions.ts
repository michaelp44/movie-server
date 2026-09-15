"use server";

import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";
import { saveGuestbookMessage, saveSongRequest } from "@/lib/data/guest-interactions";

export type SubmissionState = { status: "idle" | "success" | "error"; message: string };

const guestbookSchema = z.object({
  displayName: z.string().trim().min(2, "כתבו לנו ממי הברכה").max(80),
  message: z.string().trim().min(3, "כתבו לנו עוד כמה מילים ❤️").max(1200, "הברכה ארוכה מדי"),
});

const songSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  song: z.string().trim().min(1, "מה שם השיר?").max(160),
  artist: z.string().trim().min(1, "מי המבצע/ת?").max(160),
});

async function rateLimit(action: string, limit: number) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
  return (await consumeRateLimit(action, ip, limit, 15 * 60)).allowed;
}

export async function submitGuestbookMessage(
  _previous: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  try {
    if (!(await rateLimit("guestbook", 5))) {
      return { status: "error", message: "שלחתם כמה ברכות ברצף. נסו שוב בעוד כמה דקות ❤️" };
    }

    const parsed = guestbookSchema.safeParse({
      displayName: formData.get("displayName"),
      message: formData.get("message"),
    });
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "בדקו את הפרטים ונסו שוב" };
    }

    const invitation = await getCurrentInvitation();
    await saveGuestbookMessage({ invitationId: invitation?.id ?? null, ...parsed.data });
    return { status: "success", message: "הברכה שלכם נשמרה. עשיתם לנו את הלב ❤️" };
  } catch (error) {
    console.error("Guestbook submission failed", error);
    return { status: "error", message: "לא הצלחנו לשמור כרגע. נסו שוב בעוד רגע ❤️" };
  }
}

export async function submitSongRequest(
  _previous: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  try {
    if (!(await rateLimit("song-request", 6))) {
      return { status: "error", message: "קיבלנו מכם הרבה רעיונות — תנו לנו רגע ונסו שוב 🎵" };
    }

    const parsed = songSchema.safeParse({
      displayName: formData.get("displayName"),
      song: formData.get("song"),
      artist: formData.get("artist"),
    });
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "בדקו את הפרטים ונסו שוב" };
    }

    const invitation = await getCurrentInvitation();
    const result = await saveSongRequest({ invitationId: invitation?.id ?? null, ...parsed.data });
    return result === "duplicate"
      ? { status: "success", message: "השיר הזה כבר אצלנו ברשימה — בחירה מעולה 🎵" }
      : { status: "success", message: "השיר נוסף לרשימת הבקשות שלנו. נתראה ברחבה 🎵" };
  } catch (error) {
    console.error("Song request failed", error);
    return { status: "error", message: "לא הצלחנו לשמור כרגע. נסו שוב בעוד רגע ❤️" };
  }
}
