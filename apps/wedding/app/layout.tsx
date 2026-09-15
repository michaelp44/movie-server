import type { Metadata, Viewport } from "next";
import { Assistant, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

const editorial = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://wedding.my-rem.com"),
  applicationName: "Shoval & Michael",
  title: "Shoval & Michael | 10.12.2026",
  description: "כל מה שצריך לדעת לקראת החתונה של שובל ומיכאל — 10.12.2026",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "/",
    siteName: "Shoval & Michael",
    title: "Shoval & Michael | 10.12.2026",
    description: "מחכים לחגוג איתכם בחתונה של שובל ומיכאל — כל הפרטים במקום אחד.",
    images: [{
      url: "/og.png",
      width: 1200,
      height: 630,
      alt: "Shoval & Michael — 10.12.2026",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shoval & Michael | 10.12.2026",
    description: "מחכים לחגוג איתכם — כל פרטי החתונה במקום אחד.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "שובל ומיכאל",
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <body className={`${assistant.variable} ${editorial.variable}`}>{children}</body>
    </html>
  );
}
