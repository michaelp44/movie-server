import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createMediaUpload } from "@/lib/data/guest-interactions";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";
import { parseTableNumber } from "@/lib/table";
import { validateUploadBatch } from "@/lib/upload/validation";

export const runtime = "nodejs";

const bodySchema = z.object({
  files: z.array(z.object({
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    size: z.number().int().positive(),
  })).min(1).max(10),
  tableNumber: z.string().max(3).optional(),
  message: z.string().trim().max(600).optional(),
});

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

async function requestIdentifier() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRateLimit("upload-prepare", await requestIdentifier(), 8, 15 * 60);
    if (!rateLimit.allowed) {
      return privateJson({ message: "היו הרבה ניסיונות העלאה. חכו כמה דקות ונסו שוב ❤️" }, 429);
    }

    const rawBody: unknown = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return privateJson({ message: "פרטי הקבצים אינם תקינים" }, 400);
    }

    const validation = validateUploadBatch(parsed.data.files);
    if (!validation.success) {
      return privateJson({ message: validation.message }, 400);
    }

    const requestedTableNumber = parsed.data.tableNumber
      ? parseTableNumber(parsed.data.tableNumber)
      : null;
    if (parsed.data.tableNumber && !requestedTableNumber) {
      return privateJson({ message: "מספר השולחן אינו תקין" }, 400);
    }

    const invitation = await getCurrentInvitation();
    const uploads = await Promise.all(validation.files.map((file) => createMediaUpload({
      invitationId: invitation?.id ?? null,
      uploaderName: invitation?.displayName ?? null,
      tableNumber: invitation?.tableNumber ?? requestedTableNumber,
      mimeType: file.mimeType,
      size: file.size,
      extension: file.extension,
      message: parsed.data.message || null,
    })));

    return privateJson({ uploads });
  } catch (error) {
    console.error("Upload preparation failed", error);
    return privateJson({ message: "שירות ההעלאה עדיין לא זמין. נסו שוב מאוחר יותר ❤️" }, 503);
  }
}
