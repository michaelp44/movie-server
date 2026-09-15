import { PersonalizedHome } from "@/components/wedding/personalized-home";
import { UnidentifiedHome } from "@/components/wedding/unidentified-home";
import { isGuestIdentificationConfigured } from "@/lib/env";
import { getCurrentInvitation, isSeatingPublished } from "@/lib/guest-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const invitation = await getCurrentInvitation();
  if (!invitation) {
    return <UnidentifiedHome guestIdentificationEnabled={isGuestIdentificationConfigured()} />;
  }
  const seatingPublished = await isSeatingPublished();
  return <PersonalizedHome invitation={invitation} seatingPublished={seatingPublished} />;
}
