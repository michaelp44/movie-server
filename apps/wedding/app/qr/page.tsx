import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "QR לחתונה | שובל ומיכאל", robots: { index: false, follow: false } };

const cards = [
  { image: "/qr/wedding-site.png", title: "כל פרטי החתונה", text: "סרקו כדי להיכנס לאתר", href: "/" },
  { image: "/qr/live-wall-share.png", title: "שתפו רגע מהערב", text: "תמונה או ברכה למסך החתונה", href: "/share" },
];

export default function PrintableQrPage() {
  return (
    <main className="qr-print min-h-screen bg-[#f6f2e9] px-5 py-12 text-center text-stone-950 sm:px-10">
      <header className="mx-auto max-w-3xl">
        <p dir="ltr" className="font-serif text-5xl sm:text-7xl">Shoval &amp; Michael</p>
        <p className="mt-2 tracking-[.28em] text-[#89683a]">10.12.2026</p>
        <h1 className="mt-8 text-2xl font-semibold">סרקו וחגגו איתנו</h1>
      </header>
      <div className="mx-auto mt-10 grid max-w-4xl gap-7 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="qr-card rounded-[2rem] border border-stone-900/10 bg-white p-8 shadow-[0_20px_60px_rgba(45,37,25,.08)]">
            <Image src={card.image} width={360} height={360} alt={`QR — ${card.title}`} className="mx-auto w-full max-w-[320px]" priority />
            <h2 className="mt-6 font-serif text-4xl">{card.title}</h2>
            <p className="mt-2 text-lg text-stone-600">{card.text}</p>
          </Link>
        ))}
      </div>
      <p className="mt-9 text-sm text-stone-500 print:hidden">להדפסה: פתחו את תפריט הדפדפן ובחרו ״הדפסה״</p>
    </main>
  );
}
