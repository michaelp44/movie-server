import QRCode from "qrcode";
import { z } from "zod";

import { createAdminDataClient, getAuthenticatedAdmin } from "@/lib/admin";
import { parseTableNumber } from "@/lib/table";

const querySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("main") }),
  z.object({ kind: z.literal("photos") }),
  z.object({ kind: z.literal("table"), table: z.string().trim().min(1).max(30) }),
  z.object({ kind: z.literal("invitation"), id: z.string().uuid() }),
]);

export async function GET(request: Request) {
  if (!(await getAuthenticatedAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid QR request" }, { status: 400 });
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://wedding.my-rem.com").replace(/\/$/, "");
  let destination: string;
  if (parsed.data.kind === "main") destination = baseUrl;
  else if (parsed.data.kind === "photos") destination = `${baseUrl}/photos`;
  else if (parsed.data.kind === "table") {
    const tableNumber = parseTableNumber(parsed.data.table);
    if (!tableNumber) return Response.json({ error: "Invalid table number" }, { status: 400 });
    destination = `${baseUrl}/table/${tableNumber}`;
  } else {
    const db = createAdminDataClient();
    const { data, error } = await db.from("invitations").select("secure_token").eq("id", parsed.data.id).single();
    if (error || !data?.secure_token) return Response.json({ error: "Invitation not found" }, { status: 404 });
    destination = `${baseUrl}/g/${encodeURIComponent(String(data.secure_token))}`;
  }
  const png = await QRCode.toBuffer(destination, { type: "png", width: 1000, margin: 3, color: { dark: "#1d1b18", light: "#fffdf8" }, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="wedding-${parsed.data.kind}.png"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
