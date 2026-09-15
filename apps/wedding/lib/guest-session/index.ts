import "server-only";

import { cookies } from "next/headers";

import { getGuestSessionSecret } from "@/lib/env";
import {
  guestSessionMaxAgeSeconds,
  signGuestSessionToken,
  verifyGuestSessionToken,
} from "@/lib/guest-session/token";
import type { GuestSessionIdentity } from "@/lib/types";

export const GUEST_SESSION_COOKIE = "wedding_guest_session";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    priority: "high" as const,
  };
}

/** Must be called from a Server Action or Route Handler. */
export async function createGuestSession(invitationId: string): Promise<void> {
  const token = signGuestSessionToken(invitationId, getGuestSessionSecret(), {
    ttlSeconds: guestSessionMaxAgeSeconds,
  });
  const cookieStore = await cookies();

  cookieStore.set(GUEST_SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: guestSessionMaxAgeSeconds,
  });
}

export async function readGuestSession(): Promise<GuestSessionIdentity | null> {
  const value = (await cookies()).get(GUEST_SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }

  return verifyGuestSessionToken(value, getGuestSessionSecret());
}

/** Must be called from a Server Action or Route Handler. */
export async function clearGuestSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_SESSION_COOKIE, "", {
    ...cookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}
