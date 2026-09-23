"use client";

import { useEffect, useRef } from "react";

export function BlessingQuote({ message, name, compact = false }: { message: string | null; name: string | null; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    const quote = quoteRef.current;
    if (!container || !quote) return;
    const fit = () => {
      let low = 12;
      let high = Math.min(compact ? 48 : 96, container.clientWidth / 7, container.clientHeight / 2.5);
      for (let step = 0; step < 9; step++) {
        const size = (low + high) / 2;
        quote.style.fontSize = `${size}px`;
        if (quote.scrollHeight > container.clientHeight || quote.scrollWidth > container.clientWidth) high = size;
        else low = size;
      }
      quote.style.fontSize = `${low}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [message, name, compact]);

  return <div ref={containerRef} className="relative grid size-full min-h-0 min-w-0 place-items-center">
    <blockquote ref={quoteRef} className="m-0 w-full min-w-0 text-center text-[clamp(1.5rem,3vw,4rem)]">
      <p className="whitespace-normal break-words font-serif leading-[1.18] text-[#fffaf0]">״{message}״</p>
      {name ? <footer className="mt-[.8em] text-[clamp(.85rem,1.2vw,1.4rem)] font-semibold text-[#d7bd91]">— {name}</footer> : null}
    </blockquote>
  </div>;
}
