import "server-only";

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { getRateLimitHashSecret } from "@/lib/env";

export const GALLERY_VISITOR_COOKIE = "wedding_gallery_visitor";

export function hashGalleryVisitor(token: string) {
  return createHmac("sha256", getRateLimitHashSecret()).update(`gallery:${token}`).digest("hex");
}

export async function getGalleryViewerHash() {
  const token = (await cookies()).get(GALLERY_VISITOR_COOKIE)?.value;
  return token ? hashGalleryVisitor(token) : null;
}
