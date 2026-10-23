import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { findInvitationBySecureToken } from "@/lib/guest-data";
import { createGuestSession } from "@/lib/guest-session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordInvitationActivity } from "@/lib/rsvp/activity";

export const runtime = "nodejs";

type PersonalizedInvitationRouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, { params }: PersonalizedInvitationRouteProps) {
  const destination = new URL(request.url).searchParams.get("next") === "rsvp" ? "/rsvp" : "/";

  try {
    const requestHeaders = await headers();
    const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? requestHeaders.get("x-real-ip")
      ?? "unknown";
    const rateLimit = await consumeRateLimit("personalized-invitation", identifier, 20, 15 * 60);

    if (rateLimit.allowed) {
      const invitation = await findInvitationBySecureToken((await params).token);
      if (invitation) {
        after(() => recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.displayName, eventType: "link_opened", target: destination === "/rsvp" ? "rsvp" : "home" }));
        await createGuestSession(invitation.id);
      }
    }
  } catch (error) {
    console.error("Personalized invitation lookup failed", error);
  }

  redirect(destination);
}
