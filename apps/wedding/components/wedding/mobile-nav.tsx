"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  Gift,
  Home,
  Images,
  Info,
  UtensilsCrossed,
  X,
} from "lucide-react";

const primaryItems = [
  { href: "/", label: "בית", icon: Home },
  { href: "/table", label: "שולחן", icon: UtensilsCrossed },
  { href: "/menu", label: "תפריט", icon: ChefHat },
  { href: "/share", label: "שיתוף", icon: Images },
] as const;

const moreItems = [
  { href: "/info", label: "מידע שימושי", description: "ניווט, חניה וכל מה שצריך", icon: Info },
  { href: "/gift", label: "מתנה לזוג", description: "למי שרוצה לפנק", icon: Gift },
] as const;

function pathIsActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const moreIsActive = moreItems.some((item) => pathIsActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[35] lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="סגירת התפריט"
            className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]"
            onClick={closeMenu}
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="אפשרויות נוספות"
            className="absolute inset-x-3 top-[8.75rem] rounded-[2rem] border border-white/70 bg-[#fbf8f1] p-4 shadow-[0_28px_90px_rgba(28,24,18,0.28)]"
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#9b7845]">עוד באתר</p>
                <h2 className="mt-1 text-lg font-semibold text-stone-950">כל מה שצריך לערב שלנו</h2>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="grid size-11 place-items-center rounded-full border border-stone-900/10 bg-white text-stone-700 transition hover:bg-stone-100"
                aria-label="סגירה"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <nav aria-label="ניווט נוסף" className="grid gap-2 sm:grid-cols-2">
              {moreItems.map((item, index) => {
                const Icon = item.icon;
                const active = pathIsActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    ref={index === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-18 items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      active
                        ? "border-[#b89865]/35 bg-[#efe5d3] text-stone-950"
                        : "border-stone-900/8 bg-white/75 text-stone-700 hover:border-[#b89865]/30"
                    }`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eee4d2] text-[#876638]">
                      <Icon aria-hidden="true" size={19} strokeWidth={1.7} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-stone-500">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </section>
        </div>
      ) : null}

      <nav
        aria-label="ניווט מהיר"
        className="sticky top-16 z-40 border-b border-stone-900/10 bg-[#fbf8f1]/96 px-1 shadow-[0_10px_30px_rgba(28,24,18,0.07)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 divide-x divide-x-reverse divide-stone-900/8">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = pathIsActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[4.6rem] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition ${
                  active ? "bg-white/55 text-[#856333] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#a9854f]" : "text-stone-500 hover:bg-white/40 hover:text-stone-900"
                }`}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.1 : 1.6} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-more-menu"
            onClick={() => setOpen((value) => !value)}
            className={`relative flex min-h-[4.6rem] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition ${
              open || moreIsActive ? "bg-white/55 text-[#856333] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#a9854f]" : "text-stone-500 hover:bg-white/40 hover:text-stone-900"
            }`}
          >
            <span className="flex h-5 items-center" aria-hidden="true">
              <span className="size-1 rounded-full bg-current" />
              <span className="mx-1 size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
            </span>
            <span>עוד</span>
          </button>
        </div>
      </nav>
    </>
  );
}
