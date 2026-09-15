import type { Metadata } from "next";
import { LiveWallScreen } from "@/components/live-wall/live-wall-screen";
import { getLiveWallDemoPayload } from "@/lib/live-wall/data";

export const metadata: Metadata = { title: "הדגמת מסך החתונה", robots: { index: false, follow: false } };

export default function LiveWallDemoPage() {
  return <LiveWallScreen initial={getLiveWallDemoPayload()} demo />;
}
