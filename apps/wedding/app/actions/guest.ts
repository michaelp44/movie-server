"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { findInvitationByPhone } from "@/lib/guest-data";
import { clearGuestSession, createGuestSession } from "@/lib/guest-session";
import { consumeRateLimit } from "@/lib/rate-limit";

export type GuestLoginState = { status: "idle" | "error"; message: string };

const phoneSchema = z.string().trim().min(8).max(24);

function clientIdentifier(forwardedFor: string | null, realIp: string | null) {
  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

export async function identifyGuest(
  _previous: GuestLoginState,
  formData: FormData,
): Promise<GuestLoginState> {
  try {
    const requestHeaders = await headers();
    const identifier = clientIdentifier(requestHeaders.get("x-forwarded-for"), requestHeaders.get("x-real-ip"));
    const rateLimit = await consumeRateLimit("guest-lookup", identifier, 8, 15 * 60);

    if (!rateLimit.allowed) {
      return { status: "error", message: "ניסיתם כמה פעמים ברצף. חכו רגע קטן ונסו שוב ❤️" };
    }

    const parsed = phoneSchema.safeParse(formData.get("phone"));
    const normalized = parsed.success ? normalizeIsraeliPhone(parsed.data) : null;

    if (!normalized) {
      return { status: "error", message: "בדקו שמספר הטלפון הוזן נכון ונסו שוב ❤️" };
    }

    const invitation = await findInvitationByPhone(normalized);
    if (!invitation) {
      return {
        status: "error",
        message: "לא מצאנו את המספר הזה ברשימה. יכול להיות שההזמנה רשומה על מספר אחר ❤️",
      };
    }

    await createGuestSession(invitation.id);
  } catch (error) {
    console.error("Guest identification failed", error);
    return { status: "error", message: "משהו קטן השתבש. נסו שוב בעוד רגע ❤️" };
  }

  redirect("/");
}

export async function logoutGuest() {
  await clearGuestSession();
  redirect("/");
}
