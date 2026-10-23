"use client";

import { Navigation } from "lucide-react";

export function WazeDirectionLink({ href }: { href: string }) {
  function openWaze(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!/Android/i.test(navigator.userAgent)) return;
    event.preventDefault();
    const destination = new URL(href);
    const query = destination.searchParams.toString();
    const fallback = encodeURIComponent(href);
    window.location.href = `intent://?${query}#Intent;scheme=waze;package=com.waze;S.browser_fallback_url=${fallback};end`;
  }

  return (
    <a
      href={href}
      onClick={openWaze}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 font-semibold text-white shadow-sm transition hover:bg-[#785b34] active:scale-[0.99] sm:w-auto"
    >
      <Navigation aria-hidden="true" size={19} />
      פתיחה ב-Waze
    </a>
  );
}
