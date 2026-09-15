"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

export function GalleryLikeButton({ photoId, initialCount, initialLiked }: { photoId: string; initialCount: number; initialLiked: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/photos/${photoId}/like`, { method: "POST" });
      const payload = await response.json() as { liked?: boolean; likeCount?: number };
      if (!response.ok || typeof payload.liked !== "boolean" || typeof payload.likeCount !== "number") throw new Error("Like failed");
      setLiked(payload.liked);
      setCount(payload.likeCount);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" onClick={() => void toggle()} disabled={pending} aria-pressed={liked} aria-label={liked ? "ביטול לייק לתמונה" : "לייק לתמונה"} title={error ? "לא הצלחנו לעדכן כרגע" : undefined} className={`absolute bottom-3 left-3 inline-flex min-h-11 min-w-14 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-lg backdrop-blur-md transition active:scale-95 disabled:opacity-70 ${liked ? "bg-[#9a3041] text-white" : "bg-white/90 text-stone-800"}`}>
      <Heart size={19} aria-hidden="true" fill={liked ? "currentColor" : "none"} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
