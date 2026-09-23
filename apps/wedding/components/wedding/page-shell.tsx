import type { ReactNode } from "react";
import { MobileNav } from "@/components/wedding/mobile-nav";
import { SiteHeader } from "@/components/wedding/site-header";

type PageShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  afterTitle?: ReactNode;
  wide?: boolean;
};

export function PageShell({
  children,
  eyebrow,
  title,
  description,
  afterTitle,
  wide = false,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f2e9] text-stone-950">
      <SiteHeader />
      <MobileNav />
      <main className="overflow-hidden pb-16">
        <header className="relative border-b border-stone-900/8 px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(184,152,101,0.15),transparent_32%),radial-gradient(circle_at_88%_80%,rgba(255,255,255,0.72),transparent_28%)]"
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-[#96713e]">{eyebrow}</p>
            <h1 className="mt-4 text-balance font-serif text-5xl font-medium leading-[0.94] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              {description}
            </p>
            {afterTitle ? <div className="mt-7">{afterTitle}</div> : null}
          </div>
        </header>

        <div className={`mx-auto px-5 py-10 sm:px-8 sm:py-14 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
