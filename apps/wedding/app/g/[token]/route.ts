import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { findInvitationBySecureToken } from "@/lib/guest-data";
import { createGuestSession } from "@/lib/guest-session";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type PersonalizedInvitationRouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: PersonalizedInvitationRouteProps) {
  try {
    const requestHeaders = await headers();
    const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? requestHeaders.get("x-real-ip")
      ?? "unknown";
    const rateLimit = await consumeRateLimit("personalized-invitation", identifier, 20, 15 * 60);

    if (rateLimit.allowed) {
      const invitation = await findInvitationBySecureToken((await params).token);
      if (invitation) await createGuestSession(invitation.id);
    }
  } catch (error) {
    console.error("Personalized invitation lookup failed", error);
  }

  redirect("/");
}
