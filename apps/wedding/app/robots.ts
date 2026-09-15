import type { MetadataRoute } from "next";
import { weddingConfig } from "@/lib/wedding-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/g/"] },
    ],
    sitemap: `${weddingConfig.domain}/sitemap.xml`,
  };
}
