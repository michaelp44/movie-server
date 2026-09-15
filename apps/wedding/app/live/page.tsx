import type { Metadata } from "next";
import { LiveWallScreen } from "@/components/live-wall/live-wall-screen";
import { getLiveWallPayload } from "@/lib/live-wall/data";

export const metadata: Metadata = { title: "Live Wedding Wall | Shoval & Michael", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LiveWallPage() {
  return <LiveWallScreen initial={await getLiveWallPayload()} />;
}
