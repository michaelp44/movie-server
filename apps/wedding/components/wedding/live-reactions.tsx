"use client";

import { useState } from "react";

const reactions = ["❤️", "🔥", "😂", "🥂"] as const;

export function LiveReactions({ enabled = true }: { enabled?: boolean }) {
  const [message, setMessage] = useState("");
  async function react(emoji: typeof reactions[number]) {
    if (!enabled) return;
    const response = await fetch("/api/reactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emoji }) });
    setMessage(response.ok ? `${emoji} נשלח למסך!` : "קחו רגע ונסו שוב");
  }
  return (
    <section className="rounded-[2rem] border border-[#a9854f]/20 bg-[#eee4d2]/70 p-5 text-center sm:p-7" aria-labelledby="reaction-title">
      <h2 id="reaction-title" className="text-xl font-semibold">שלחו תגובה למסך</h2>
      <p className="mt-1 text-sm text-stone-600">נגיעה אחת והיא תרחף לרגע על מסך החתונה</p>
      <div className="mt-5 flex justify-center gap-3">{reactions.map((emoji) => <button key={emoji} type="button" disabled={!enabled} onClick={() => react(emoji)} className="grid size-14 place-items-center rounded-full border border-black/10 bg-white text-2xl shadow-sm transition hover:-translate-y-1 disabled:opacity-40" aria-label={`שליחת ${emoji}`}>{emoji}</button>)}</div>
      <p className="mt-3 min-h-5 text-sm text-[#765b35]" aria-live="polite">{message}</p>
    </section>
  );
}
