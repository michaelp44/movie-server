"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveWallPayload } from "@/lib/live-wall/data";
import { buildWallQueue, nextIllustration, type WallItem } from "@/lib/live-wall/queue";
import { BlessingQuote } from "./blessing-quote";
import { detectPhotoFaces } from "@/lib/live-wall/face-detection";
import { centeredFaceCrop, faceCropPosition } from "@/lib/live-wall/face-crop";

const CALM_ROTATION_MS = 11_000;
const PARTY_ROTATION_MS = 8_500;
const FRAME_SIZE = 5;
type Scene = "collage" | "spotlight" | "blessing" | "mosaic" | "illustration" | "favorite";

// Private Supabase objects are returned with `cache-control: no-cache`. Scenes
// remount their images frequently, so keeping one in-memory blob URL per asset
// prevents the projector from downloading the same full-size photo all night.
const cachedMediaUrls = new Map<string, string>();
const pendingMediaUrls = new Map<string, Promise<string>>();

function cachedMediaUrl(src: string): Promise<string> {
  const cached = cachedMediaUrls.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = pendingMediaUrls.get(src);
  if (pending) return pending;
  const request = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`Media request failed (${response.status})`);
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      cachedMediaUrls.set(src, url);
      pendingMediaUrls.delete(src);
      return url;
    })
    .catch((error) => {
      pendingMediaUrls.delete(src);
      throw error;
    });
  pendingMediaUrls.set(src, request);
  return request;
}

function uniqueFrame(queue: WallItem[], all: WallItem[], count = FRAME_SIZE): WallItem[] {
  const seen = new Set<string>();
  return [...queue, ...all].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, count);
}

function SmartCropImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [cachedSource, setCachedSource] = useState(() => ({ source: src, url: cachedMediaUrls.get(src) ?? src }));
  const displaySrc = cachedSource.source === src ? cachedSource.url : cachedMediaUrls.get(src) ?? src;
  const [objectPosition, setObjectPosition] = useState("50% 10%");
  const [crop, setCrop] = useState<ReturnType<typeof centeredFaceCrop>>(null);
  useEffect(() => {
    let active = true;
    void cachedMediaUrl(src).then((url) => {
      if (active) setCachedSource({ source: src, url });
    }).catch(() => {
      // Keep the original signed URL visible if preloading fails.
    });
    return () => { active = false; };
  }, [src]);
  useEffect(() => {
    const image = imageRef.current;
    const card = image?.parentElement;
    if (!image || !card) return;
    let active = true;
    const update = async () => {
      if (!image.complete || !image.naturalWidth) return;
      const faces = await detectPhotoFaces(image);
      if (active) {
        setObjectPosition(faceCropPosition(image.naturalWidth, image.naturalHeight, card.clientWidth, card.clientHeight, faces));
        setCrop(centeredFaceCrop(image.naturalWidth, image.naturalHeight, card.clientWidth, card.clientHeight, faces));
      }
    };
    image.addEventListener("load", update);
    const observer = new ResizeObserver(() => void update());
    observer.observe(card);
    void update();
    return () => { active = false; observer.disconnect(); image.removeEventListener("load", update); };
  }, [src]);

  return (
    // Private signed URLs cannot use the public Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      ref={imageRef}
      alt={alt}
      crossOrigin="anonymous"
      className={`live-wall-photo-smart ${className}`}
      style={{ objectPosition, ...crop }}
    />
  );
}

function Media({ item, className = "" }: { item: WallItem; className?: string }) {
  return item.mediaUrl ? <SmartCropImage src={item.mediaUrl} alt="רגע מהחתונה" className={className} /> : null;
}

function PhotoCaption({ item, prominent = false }: { item: WallItem; prominent?: boolean }) {
  if (!item.message && !item.displayName) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-[clamp(1.2rem,2.2vw,2.8rem)] pt-[clamp(4rem,9vw,9rem)] text-start">
      {item.message ? <p className={`${prominent ? "text-[clamp(1.6rem,2.8vw,3.5rem)]" : "text-[clamp(1rem,1.45vw,1.7rem)]"} max-w-[26ch] font-serif leading-[1.2] drop-shadow-lg`}>״{item.message}״</p> : null}
      {item.displayName ? <p className="mt-3 text-[clamp(.72rem,1vw,1.05rem)] font-semibold tracking-wide text-[#ead5ad]">— {item.displayName}</p> : null}
    </div>
  );
}

function BlessingCard({ item, compact = false }: { item: WallItem; compact?: boolean }) {
  return (
    <article className="live-wall-card relative grid size-full min-h-0 place-items-center overflow-hidden rounded-[clamp(1.3rem,2vw,2.5rem)] border border-white/10 bg-[linear-gradient(145deg,rgba(215,189,145,.2),rgba(255,255,255,.055))] p-[clamp(1.4rem,3vw,4rem)] text-center shadow-[0_28px_90px_rgba(0,0,0,.3)]">
      <span className="absolute -left-8 -top-12 font-serif text-[12rem] leading-none text-white/[.035]">&amp;</span>
      <BlessingQuote message={item.message} name={item.displayName} compact={compact} />
    </article>
  );
}

function CollageScene({ items }: { items: WallItem[] }) {
  return (
    <div className="grid h-full grid-cols-12 grid-rows-2 gap-[clamp(.75rem,1.3vw,1.5rem)]">
      {items.slice(0, 3).map((item, index) => {
        const placement = index === 0 ? "col-span-7 row-span-2" : "col-span-5";
        return item.mediaUrl ? (
          <article key={item.id} className={`live-wall-card relative min-h-0 overflow-hidden rounded-[clamp(1.3rem,2vw,2.5rem)] bg-white/5 shadow-[0_28px_90px_rgba(0,0,0,.42)] ${placement}`} style={{ animationDelay: `${index * 140}ms` }}>
            <Media item={item} /><div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" /><PhotoCaption item={item} prominent={index === 0} />
          </article>
        ) : <div key={item.id} className={placement}><BlessingCard item={item} compact={index !== 0} /></div>;
      })}
    </div>
  );
}

function MosaicScene({ items }: { items: WallItem[] }) {
  return (
    <div className="live-wall-mosaic grid h-full grid-cols-12 grid-rows-8 gap-[clamp(.65rem,1vw,1.15rem)]">
      {items.slice(0, 5).map((item, index) => {
        const placement = ["col-span-5 row-span-5", "col-span-4 row-span-5", "col-span-3 row-span-5", "col-span-7 row-span-3", "col-span-5 row-span-3"][index];
        return item.mediaUrl ? <article key={item.id} className={`live-wall-card relative overflow-hidden rounded-[clamp(1rem,1.7vw,2rem)] ${placement}`} style={{ animationDelay: `${index * 110}ms` }}><Media item={item} /><div className="absolute inset-0 ring-1 ring-inset ring-white/10" />{index < 2 ? <PhotoCaption item={item} /> : null}</article>
          : <div key={item.id} className={placement}><BlessingCard item={item} compact /></div>;
      })}
    </div>
  );
}

function SpotlightScene({ item, premiere = false, favorite = false }: { item: WallItem; premiere?: boolean; favorite?: boolean }) {
  if (!item.mediaUrl) return <BlessingCard item={item} />;
  return (
    <article className="live-wall-spotlight relative h-full overflow-hidden rounded-[clamp(1.5rem,2.5vw,3rem)] bg-black shadow-[0_35px_120px_rgba(0,0,0,.5)]">
      <Media item={item} /><div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/20" />
      {premiere ? <div className="live-wall-premiere-badge absolute left-[clamp(1.5rem,3vw,3.5rem)] top-[clamp(1.5rem,3vw,3.5rem)] rounded-full border border-white/20 bg-black/35 px-5 py-2 text-[clamp(.75rem,1vw,1rem)] font-semibold tracking-[.16em] backdrop-blur">הרגע הגיע למסך ✦</div> : null}
      {favorite ? <div className="live-wall-premiere-badge absolute left-[clamp(1.5rem,3vw,3.5rem)] top-[clamp(1.5rem,3vw,3.5rem)] rounded-full border border-white/20 bg-black/35 px-5 py-2 text-[clamp(.75rem,1vw,1rem)] font-semibold tracking-[.1em] backdrop-blur">אחד הרגעים שאהבתם במיוחד ♥</div> : null}
      <PhotoCaption item={item} prominent />
    </article>
  );
}

function BlessingScene({ blessing, photos }: { blessing: WallItem; photos: WallItem[] }) {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden rounded-[clamp(1.5rem,2.5vw,3rem)] border border-white/10 bg-[#211d17]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(215,189,145,.26),transparent_52%)] opacity-35" />
      {photos.slice(0, 4).map((photo, index) => <div key={photo.id} className={`live-wall-polaroid absolute hidden overflow-hidden rounded-2xl border-[.45rem] border-[#f8f1e5] bg-[#f8f1e5] shadow-2xl lg:block live-wall-polaroid-${index + 1}`}><Media item={photo} /></div>)}
      <div className="live-wall-quote relative z-10 h-[80%] w-[85%] lg:w-[54%]">
        <BlessingQuote message={blessing.message} name={blessing.displayName} />
      </div>
    </div>
  );
}

function IllustrationScene({ item }: { item: WallItem }) {
  if (!item.mediaUrl || !item.illustrationUrl) return <SpotlightScene item={item} />;
  return (
    <article className="live-wall-illustration relative grid h-full grid-cols-2 overflow-hidden rounded-[clamp(1.5rem,2.5vw,3rem)] bg-black shadow-[0_35px_120px_rgba(0,0,0,.5)]">
      <div className="relative overflow-hidden"><Media item={item} /><span className="absolute bottom-6 left-6 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold backdrop-blur">הרגע</span></div>
      <div className="live-wall-illustration-reveal relative overflow-hidden">
        <SmartCropImage src={item.illustrationUrl} alt="גרסה מאוירת של הרגע" />
        <span className="absolute bottom-6 right-6 rounded-full bg-[#fffaf0]/90 px-4 py-2 text-sm font-bold text-[#1d1b18]">הרגע המאויר ✦</span>
      </div>
      <div className="absolute inset-y-0 left-1/2 z-10 w-px bg-white/65 shadow-[0_0_35px_white]" />
      {item.displayName ? <p className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#17140f]/85 px-6 py-2 text-[clamp(.85rem,1.15vw,1.2rem)] text-[#ead5ad] backdrop-blur">{item.displayName}</p> : null}
    </article>
  );
}

export function LiveWallScreen({ initial, demo = false }: { initial: LiveWallPayload; demo?: boolean }) {
  const [payload, setPayload] = useState(initial);
  const [visible, setVisible] = useState<WallItem[]>(initial.items.slice(0, FRAME_SIZE));
  const [history, setHistory] = useState<string[]>(initial.items.slice(0, FRAME_SIZE).map((item) => item.id));
  const [scene, setScene] = useState<Scene>("collage");
  const [sceneNumber, setSceneNumber] = useState(0);
  const [premiere, setPremiere] = useState(false);
  const [online, setOnline] = useState(true);
  const [partyMode, setPartyMode] = useState(false);
  const [floating, setFloating] = useState<Array<{ id: string; emoji: string }>>([]);
  const seenReactions = useRef(new Set<string>());
  const knownItems = useRef(new Set(initial.items.map((item) => item.id)));
  const stableMediaUrls = useRef(new Map(initial.items.map((item) => [item.id, {
    mediaUrl: item.mediaUrl,
    illustrationUrl: item.illustrationUrl,
  }])));
  const premiereActive = useRef(false);
  const premiereTimer = useRef<number | null>(null);
  const advanceRef = useRef<() => void>(() => undefined);
  const illustrationHistory = useRef<string[]>([]);

  const queue = useMemo(() => buildWallQueue(payload.items, history), [payload.items, history]);
  const advance = useCallback(() => {
    if (payload.controls.paused || payload.controls.blank || premiereActive.current) return;
    const nextNumber = sceneNumber + 1;
    const next = uniqueFrame(queue, payload.items);
    const photos = next.filter((item) => item.mediaUrl);
    const blessings = next.filter((item) => !item.mediaUrl && item.message);
    const illustrated = payload.items.filter((item) => item.illustrationUrl);
    const favorite = payload.items.filter((item) => item.mediaUrl && (item.likeCount ?? 0) > 0).sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];
    let nextScene: Scene = "collage";
    if (nextNumber % 10 === 0 && favorite) {
      nextScene = "favorite";
      next.unshift(favorite);
    } else if (nextNumber % 8 === 0 && illustrated.length) {
      nextScene = "illustration";
      const illustratedItem = nextIllustration(illustrated, illustrationHistory.current)!;
      illustrationHistory.current = [...illustrationHistory.current.slice(-99), illustratedItem.id];
      next.unshift(illustratedItem);
    } else if (nextNumber % 6 === 0 && blessings.length) nextScene = "blessing";
    else if (nextNumber % 4 === 0 && photos.length) nextScene = "spotlight";
    else if (nextNumber % 3 === 0 && next.length >= 4) nextScene = "mosaic";
    setScene(nextScene);
    setSceneNumber(nextNumber);
    setVisible(uniqueFrame(next, payload.items));
    if (next.length) setHistory((value) => [...value.slice(-14), ...next.map((item) => item.id)]);
  }, [payload.controls.blank, payload.controls.paused, payload.items, queue, sceneNumber]);
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  useEffect(() => {
    const updateMood = () => { const hour = new Date().getHours(); setPartyMode(hour >= 22 || hour < 3); };
    updateMood();
    const interval = window.setInterval(updateMood, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (demo) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const received = await response.json() as LiveWallPayload;
        if (!active) return;
        const next: LiveWallPayload = {
          ...received,
          items: received.items.map((item) => {
            const cached = stableMediaUrls.current.get(item.id);
            const stable = {
              mediaUrl: cached?.mediaUrl ?? item.mediaUrl,
              illustrationUrl: cached?.illustrationUrl ?? item.illustrationUrl,
            };
            stableMediaUrls.current.set(item.id, stable);
            return { ...item, ...stable };
          }),
        };
        const fresh = next.items.find((item) => !knownItems.current.has(item.id));
        next.items.forEach((item) => knownItems.current.add(item.id));
        setPayload(next);
        setOnline(true);
        if (fresh) {
          premiereActive.current = true;
          setPremiere(true);
          setScene("spotlight");
          setVisible(uniqueFrame([fresh], next.items));
          if (premiereTimer.current) window.clearTimeout(premiereTimer.current);
          premiereTimer.current = window.setTimeout(() => {
            premiereActive.current = false;
            setPremiere(false);
            advanceRef.current();
          }, 14_000);
        } else {
          setVisible((shown) => {
            const retained = shown.filter((item) => next.items.some((candidate) => candidate.id === item.id));
            return retained.length ? retained.map((item) => next.items.find((candidate) => candidate.id === item.id) ?? item) : next.items.slice(0, FRAME_SIZE);
          });
        }
        const newReactions = next.reactions.filter((reaction) => !seenReactions.current.has(reaction.id));
        newReactions.forEach((reaction) => seenReactions.current.add(reaction.id));
        if (newReactions.length) {
          setFloating(newReactions.slice(-8).map((reaction) => ({ id: reaction.id, emoji: reaction.emoji })));
          window.setTimeout(() => active && setFloating([]), 4200);
        }
      } catch { if (active) setOnline(false); }
    };
    const interval = window.setInterval(poll, 10_000);
    const reconnect = () => void poll();
    window.addEventListener("online", reconnect);
    void poll();
    return () => {
      active = false;
      window.clearInterval(interval);
      if (premiereTimer.current) window.clearTimeout(premiereTimer.current);
      window.removeEventListener("online", reconnect);
    };
  }, [demo]);

  useEffect(() => {
    const interval = window.setInterval(() => advanceRef.current(), partyMode ? PARTY_ROTATION_MS : CALM_ROTATION_MS);
    return () => window.clearInterval(interval);
  }, [partyMode]);

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
  const featured = visible[0];
  const blessing = visible.find((item) => item.kind === "blessing") ?? payload.items.find((item) => item.kind === "blessing") ?? featured;

  return (
    <main className={`relative h-dvh overflow-hidden text-white ${partyMode ? "live-wall-party bg-[#100d16]" : "bg-[#15130f]"}`} aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(177,137,77,.22),transparent_34%),radial-gradient(circle_at_8%_88%,rgba(255,255,255,.08),transparent_36%)]" />
      <div className="live-wall-grain pointer-events-none absolute inset-0 opacity-25" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(1.5rem,3vw,3.5rem)] pt-[clamp(1.15rem,1.8vw,2rem)]">
        <div dir="ltr"><p className="font-serif text-[clamp(1.4rem,2.2vw,2.7rem)] tracking-wide">Shoval &amp; Michael</p><p className="text-[clamp(.58rem,.78vw,.82rem)] tracking-[.35em] text-white/45">10.12.2026</p></div>
        <p className="absolute left-1/2 -translate-x-1/2 text-[clamp(.75rem,1vw,1rem)] font-semibold tracking-[.2em] text-[#d7bd91]">רגעים מהערב שלנו</p>
        {demo ? <span className="rounded-full bg-[#d7bd91]/15 px-4 py-2 text-sm text-[#d7bd91]">מצב הדגמה</span> : !online ? <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/55">מתחברים מחדש…</span> : <span className="flex items-center gap-2 text-xs text-white/45"><i className="size-2 animate-pulse rounded-full bg-[#d7bd91]" />LIVE</span>}
      </header>

      <section key={`${scene}:${visible.map((item) => item.id).join(":") || "empty"}`} className="relative z-10 h-full px-[clamp(1.2rem,2.7vw,3.2rem)] pb-[clamp(7.5rem,10vw,10rem)] pt-[clamp(5.3rem,7vw,7.5rem)]">
        {featured ? (
          scene === "illustration" ? <IllustrationScene item={visible.find((item) => item.illustrationUrl) ?? featured} />
            : scene === "blessing" && blessing ? <BlessingScene blessing={blessing} photos={payload.items.filter((item) => item.mediaUrl)} />
              : scene === "spotlight" || scene === "favorite" ? <SpotlightScene item={featured} premiere={premiere} favorite={scene === "favorite"} />
                : scene === "mosaic" ? <MosaicScene items={visible} />
                  : <CollageScene items={visible} />
        ) : <div className="grid h-full place-items-center text-center"><div><p className="font-serif text-[clamp(4rem,9vw,10rem)]">מחכים לרגעים שלכם</p><p className="mt-6 text-[clamp(1.2rem,2vw,2rem)] text-white/60">שתפו תמונה או ברכה והיא תופיע כאן</p></div></div>}
      </section>

      <aside className="absolute bottom-[clamp(1rem,1.7vw,1.8rem)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-[1.35rem] border border-white/15 bg-[#fffaf0]/95 py-2 pe-5 ps-2 text-[#1d1b18] shadow-[0_18px_60px_rgba(0,0,0,.4)] backdrop-blur">
        {/* This QR points directly to the guest sharing page and sits outside the photo stage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/qr/live-wall-share.png" alt="QR להעלאת תמונה או ברכה" className="size-[clamp(4.8rem,6vw,6.5rem)] rounded-xl" />
        <p className="max-w-44 text-[clamp(.72rem,.92vw,1rem)] font-bold leading-snug">סרקו ושתפו תמונה או ברכה ❤️</p>
      </aside>
      <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">{floating.map((reaction, index) => <span key={reaction.id} className="animate-float-reaction absolute bottom-10 text-[clamp(3rem,6vw,7rem)]" style={{ left: `${12 + ((index * 13) % 74)}%`, animationDelay: `${index * 110}ms` }}>{reaction.emoji}</span>)}</div>
    </main>
  );
}
