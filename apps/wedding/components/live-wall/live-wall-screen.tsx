"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveWallPayload } from "@/lib/live-wall/data";
import { buildWallQueue, type WallItem } from "@/lib/live-wall/queue";

const ROTATION_MS = 12_000;
const FRAME_SIZE = 3;

function uniqueFrame(queue: WallItem[], all: WallItem[]): WallItem[] {
  const seen = new Set<string>();
  return [...queue, ...all].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, FRAME_SIZE);
}

function WallCard({ item, index, onImageError }: { item: WallItem; index: number; onImageError(): void }) {
  const featured = index === 0;
  const cardClass = featured
    ? "live-wall-featured lg:col-span-7 lg:row-span-2"
    : index === 1
      ? "lg:col-span-5"
      : index === 2
        ? "lg:col-span-5"
        : "hidden";

  if (item.mediaUrl) {
    return (
      <article className={`live-wall-card group relative min-h-0 overflow-hidden rounded-[clamp(1.4rem,2vw,2.6rem)] bg-white/5 shadow-[0_28px_90px_rgba(0,0,0,.4)] ${cardClass}`} style={{ animationDelay: `${index * 140}ms` }}>
        {/* Private signed URLs cannot use the public Next image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.mediaUrl} alt="רגע מהחתונה" onError={onImageError} className="live-wall-photo absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-[clamp(1.2rem,2.2vw,2.8rem)] text-start">
          {item.message ? <p className={`${featured ? "text-[clamp(1.5rem,2.5vw,3.2rem)]" : "text-[clamp(1.1rem,1.55vw,1.8rem)]"} max-w-[24ch] font-light leading-[1.25] drop-shadow-lg`}>״{item.message}״</p> : null}
          {item.displayName ? <p className="mt-3 text-[clamp(.75rem,1vw,1.1rem)] tracking-wide text-[#ead5ad]">— {item.displayName}</p> : null}
        </div>
      </article>
    );
  }

  return (
    <article className={`live-wall-card relative grid min-h-0 place-items-center overflow-hidden rounded-[clamp(1.4rem,2vw,2.6rem)] border border-white/10 bg-[linear-gradient(145deg,rgba(215,189,145,.2),rgba(255,255,255,.055))] p-[clamp(1.5rem,3vw,4rem)] text-center shadow-[0_28px_90px_rgba(0,0,0,.28)] ${cardClass}`} style={{ animationDelay: `${index * 140}ms` }}>
      <span className="absolute -left-8 -top-12 font-serif text-[12rem] leading-none text-white/[.035]">&amp;</span>
      <blockquote className="relative">
        <p className={`${featured ? "text-[clamp(2.1rem,4.2vw,5.2rem)]" : "text-[clamp(1.35rem,2.2vw,2.6rem)]"} font-serif leading-[1.16]`}>״{item.message}״</p>
        {item.displayName ? <footer className="mt-[clamp(1rem,2vw,2rem)] text-[clamp(.8rem,1.2vw,1.3rem)] text-[#d7bd91]">— {item.displayName}</footer> : null}
      </blockquote>
    </article>
  );
}

export function LiveWallScreen({ initial, demo = false }: { initial: LiveWallPayload; demo?: boolean }) {
  const [payload, setPayload] = useState(initial);
  const [visible, setVisible] = useState<WallItem[]>(initial.items.slice(0, FRAME_SIZE));
  const [history, setHistory] = useState<string[]>(initial.items.slice(0, FRAME_SIZE).map((item) => item.id));
  const [online, setOnline] = useState(true);
  const [floating, setFloating] = useState<Array<{ id: string; emoji: string }>>([]);
  const seenReactions = useRef(new Set<string>());
  const advanceRef = useRef<() => void>(() => undefined);

  const queue = useMemo(() => buildWallQueue(payload.items, history), [payload.items, history]);
  const advance = useCallback(() => {
    if (payload.controls.paused || payload.controls.blank) return;
    const next = uniqueFrame(queue, payload.items);
    setVisible(next);
    if (next.length) setHistory((value) => [...value.slice(-10), ...next.map((item) => item.id)]);
  }, [payload.controls.blank, payload.controls.paused, payload.items, queue]);

  useEffect(() => { advanceRef.current = advance; }, [advance]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const next = await response.json() as LiveWallPayload;
        if (!active) return;
        setVisible((shown) => {
          const retained = shown.filter((item) => next.items.some((candidate) => candidate.id === item.id));
          return retained.length ? retained : next.items.slice(0, FRAME_SIZE);
        });
        setPayload(next);
        setOnline(true);
        const newReactions = next.reactions.filter((reaction) => !seenReactions.current.has(reaction.id));
        newReactions.forEach((reaction) => seenReactions.current.add(reaction.id));
        if (newReactions.length) {
          setFloating(newReactions.slice(-8).map((reaction) => ({ id: reaction.id, emoji: reaction.emoji })));
          window.setTimeout(() => active && setFloating([]), 3500);
        }
      } catch {
        if (active) setOnline(false);
      }
    };
    const interval = window.setInterval(poll, 5_000);
    const reconnect = () => void poll();
    window.addEventListener("online", reconnect);
    void poll();
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("online", reconnect); };
  }, [demo]);

  useEffect(() => {
    const interval = window.setInterval(() => advanceRef.current(), ROTATION_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let lock: { release(): Promise<void> } | undefined;
    const acquire = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
        if (wakeLock && document.visibilityState === "visible") lock = await wakeLock.request("screen");
      } catch { /* Browsers may deny wake locks; fullscreen display still works. */ }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { document.removeEventListener("visibilitychange", acquire); void lock?.release(); };
  }, []);

  if (payload.controls.blank || !payload.controls.enabled) return <main className="h-dvh bg-[#15130f]" aria-label="מסך החתונה מושהה" />;

  return (
    <main className="relative h-dvh overflow-hidden bg-[#15130f] text-white" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_15%,rgba(177,137,77,.2),transparent_34%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,.08),transparent_36%)]" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-[clamp(1.5rem,3vw,3.5rem)] pt-[clamp(1.2rem,2vw,2.5rem)]">
        <div dir="ltr"><p className="font-serif text-[clamp(1.5rem,2.4vw,3rem)] tracking-wide">Shoval &amp; Michael</p><p className="text-[clamp(.6rem,.85vw,.9rem)] tracking-[.35em] text-white/50">10.12.2026</p></div>
        {demo ? <span className="rounded-full bg-[#d7bd91]/15 px-4 py-2 text-sm text-[#d7bd91]">מצב הדגמה</span> : !online ? <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/55">מתחברים מחדש…</span> : null}
      </header>

      <section key={visible.map((item) => item.id).join(":") || "empty"} className="relative z-10 h-full px-[clamp(1.3rem,3vw,3.5rem)] pb-[clamp(1.3rem,2vw,2.5rem)] pt-[clamp(6rem,8vw,8.5rem)]">
        {visible.length ? (
          <div className="grid h-full grid-cols-1 gap-[clamp(.8rem,1.4vw,1.6rem)] lg:grid-cols-12 lg:grid-rows-2">
            {visible.map((item, index) => <WallCard key={item.id} item={item} index={index} onImageError={advance} />)}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center"><div><p className="font-serif text-[clamp(4rem,9vw,10rem)]">מחכים לרגעים שלכם</p><p className="mt-6 text-[clamp(1.2rem,2vw,2rem)] text-white/60">שתפו תמונה או ברכה והיא תופיע כאן</p></div></div>
        )}
      </section>

      <aside className="absolute bottom-[clamp(2rem,3vw,3.5rem)] right-[clamp(2rem,3vw,3.5rem)] z-20 flex items-center gap-3 rounded-2xl bg-[#fffaf0]/95 p-2.5 text-[#1d1b18] shadow-2xl backdrop-blur">
        {/* This QR points directly to the guest sharing page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/qr/live-wall-share.png" alt="QR להעלאת תמונה או ברכה" className="size-[clamp(5rem,7vw,7.5rem)]" />
        <p className="max-w-40 text-[clamp(.75rem,1vw,1.05rem)] font-semibold leading-snug">סרקו והעלו תמונה או ברכה ❤️</p>
      </aside>

      <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">{floating.map((reaction, index) => <span key={reaction.id} className="animate-float-reaction absolute bottom-10 text-[clamp(3rem,6vw,7rem)]" style={{ left: `${15 + ((index * 13) % 70)}%`, animationDelay: `${index * 120}ms` }}>{reaction.emoji}</span>)}</div>
    </main>
  );
}
