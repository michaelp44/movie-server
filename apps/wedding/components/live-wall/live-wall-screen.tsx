"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveWallPayload } from "@/lib/live-wall/data";
import { buildWallQueue, type WallItem } from "@/lib/live-wall/queue";

const ROTATION_MS = 10_000;

export function LiveWallScreen({ initial, demo = false }: { initial: LiveWallPayload; demo?: boolean }) {
  const [payload, setPayload] = useState(initial);
  const [current, setCurrent] = useState<WallItem | null>(initial.items[0] ?? null);
  const [history, setHistory] = useState<string[]>(initial.items[0] ? [initial.items[0].id] : []);
  const [showStats, setShowStats] = useState(false);
  const [online, setOnline] = useState(true);
  const [floating, setFloating] = useState<Array<{ id: string; emoji: string }>>([]);
  const seenReactions = useRef(new Set<string>());
  const turns = useRef(0);
  const advanceRef = useRef<() => void>(() => undefined);

  const queue = useMemo(() => buildWallQueue(payload.items, history), [payload.items, history]);

  const advance = useCallback(() => {
    if (payload.controls.paused || payload.controls.blank) return;
    turns.current += 1;
    if (turns.current % 7 === 0 && payload.stats.photos + payload.stats.blessings > 0) {
      setShowStats(true);
      return;
    }
    setShowStats(false);
    const next = queue[0] ?? payload.items[0] ?? null;
    setCurrent(next);
    if (next) setHistory((value) => [...value.slice(-7), next.id]);
  }, [payload.controls.blank, payload.controls.paused, payload.items, payload.stats, queue]);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const next = await response.json() as LiveWallPayload;
        if (!active) return;
        setCurrent((shown) => shown && next.items.some((item) => item.id === shown.id) ? shown : next.items[0] ?? null);
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
    <main className="relative grid h-dvh overflow-hidden bg-[#171511] text-white" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(177,137,77,.18),transparent_36%),radial-gradient(circle_at_15%_80%,rgba(255,255,255,.08),transparent_34%)]" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-[clamp(1.5rem,3vw,3.5rem)]">
        <div dir="ltr"><p className="font-serif text-[clamp(1.6rem,3vw,3.5rem)] tracking-wide">Shoval &amp; Michael</p><p className="text-[clamp(.65rem,1vw,1rem)] tracking-[.35em] text-white/50">10.12.2026</p></div>
        {demo ? <span className="rounded-full bg-[#d7bd91]/15 px-4 py-2 text-sm text-[#d7bd91]">מצב הדגמה</span> : !online ? <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/55">מתחברים מחדש…</span> : null}
      </header>

      <section key={showStats ? "stats" : current?.id ?? "empty"} className="animate-wall-reveal relative z-10 grid h-full place-items-center px-[clamp(2rem,7vw,8rem)] py-[clamp(7rem,10vw,10rem)] text-center">
        {showStats ? (
          <div><p className="text-[clamp(1.2rem,2vw,2rem)] text-[#d7bd91]">הרגעים שלכם הערב</p><div className="mt-8 flex gap-[clamp(3rem,10vw,10rem)]"><div><strong className="font-serif text-[clamp(5rem,12vw,12rem)] font-normal">{payload.stats.photos}</strong><p className="text-[clamp(1.2rem,2vw,2rem)] text-white/65">תמונות ששותפו</p></div><div><strong className="font-serif text-[clamp(5rem,12vw,12rem)] font-normal">{payload.stats.blessings}</strong><p className="text-[clamp(1.2rem,2vw,2rem)] text-white/65">ברכות שקיבלנו</p></div></div></div>
        ) : current?.mediaUrl ? (
          <div className={`grid max-h-full w-full items-center gap-[clamp(2rem,5vw,6rem)] ${current.message ? "lg:grid-cols-[1.35fr_.65fr]" : ""}`}>
            {/* Private signed URLs cannot use the public Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.mediaUrl} alt="רגע מהחתונה" onError={advance} className={`mx-auto max-h-[72vh] w-auto max-w-full rounded-[2rem] object-contain shadow-[0_35px_100px_rgba(0,0,0,.4)] ${current.message ? "lg:ms-auto" : ""}`} />
            {current.message ? <blockquote className="text-start"><p className="text-[clamp(2rem,4vw,5rem)] font-light leading-[1.25]">״{current.message}״</p>{current.displayName ? <footer className="mt-7 text-[clamp(1rem,1.7vw,1.6rem)] text-[#d7bd91]">— {current.displayName}</footer> : null}</blockquote> : current.displayName ? <p className="absolute bottom-[6vh] left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-6 py-3 text-[clamp(1rem,1.5vw,1.4rem)] backdrop-blur">שותף על ידי {current.displayName}</p> : null}
          </div>
        ) : current?.message ? (
          <blockquote className="max-w-[1500px]"><p className="font-serif text-[clamp(3rem,7vw,8rem)] leading-[1.18]">״{current.message}״</p>{current.displayName ? <footer className="mt-10 text-[clamp(1.3rem,2.5vw,2.5rem)] text-[#d7bd91]">— {current.displayName}</footer> : null}</blockquote>
        ) : (
          <div><p className="font-serif text-[clamp(4rem,9vw,10rem)]">מחכים לרגעים שלכם</p><p className="mt-6 text-[clamp(1.2rem,2vw,2rem)] text-white/60">שתפו תמונה או ברכה והיא תופיע כאן</p></div>
        )}
      </section>

      <aside className="absolute bottom-[clamp(1.5rem,3vw,3rem)] right-[clamp(1.5rem,3vw,3rem)] z-20 flex items-center gap-4 rounded-2xl bg-[#f7f1e5] p-3 text-[#1d1b18] shadow-2xl">
        {/* Static site QR is generated from the configured production URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/qr/live-wall-share.png" alt="QR לשיתוף תמונה או ברכה" className="size-[clamp(5rem,8vw,8rem)]" />
        <p className="max-w-44 text-[clamp(.8rem,1.2vw,1.2rem)] font-semibold leading-snug">שתפו תמונה או ברכה ❤️</p>
      </aside>

      <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">{floating.map((reaction, index) => <span key={reaction.id} className="animate-float-reaction absolute bottom-10 text-[clamp(3rem,6vw,7rem)]" style={{ left: `${15 + ((index * 13) % 70)}%`, animationDelay: `${index * 120}ms` }}>{reaction.emoji}</span>)}</div>
    </main>
  );
}
