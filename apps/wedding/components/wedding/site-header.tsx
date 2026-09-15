import Link from "next/link";
import { weddingConfig } from "@/lib/wedding-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-900/8 bg-[#f6f2e9]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:h-20">
        <Link
          href="/"
          className="group inline-flex items-baseline gap-2 text-stone-950"
          aria-label="שובל ומיכאל — עמוד הבית"
        >
          <span
            className="font-serif text-2xl font-medium tracking-[-0.04em] transition-colors group-hover:text-[#8d6c3b] sm:text-[1.75rem]"
            dir="ltr"
          >
            S&amp;M
          </span>
          <span className="hidden text-[10px] tracking-[0.2em] text-stone-500 sm:inline">
            {weddingConfig.displayDate}
          </span>
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-0.5 lg:flex">
          {weddingConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-[13px] font-medium text-stone-600 transition-colors hover:bg-white/70 hover:text-stone-950 focus-visible:bg-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="text-[11px] tracking-[0.16em] text-stone-500 lg:hidden" dir="ltr">
          SHOVAL &amp; MICHAEL
        </p>
      </div>
    </header>
  );
}
