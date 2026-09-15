import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shoval & Michael | 10.12.2026",
    short_name: "שובל ומיכאל",
    description: "אתר החתונה של שובל ומיכאל",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2e9",
    theme_color: "#f6f2e9",
    orientation: "portrait-primary",
    lang: "he",
    dir: "rtl",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
