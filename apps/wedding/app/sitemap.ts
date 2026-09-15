import type { MetadataRoute } from "next";
import { weddingConfig } from "@/lib/wedding-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/menu", "/schedule", "/story", "/photos", "/info", "/gift", "/guestbook", "/song"];
  return routes.map((route, index) => ({
    url: `${weddingConfig.domain}${route}`,
    lastModified: new Date("2026-09-14"),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
