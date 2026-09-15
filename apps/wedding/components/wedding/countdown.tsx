"use client";

import { useEffect, useState } from "react";

type CountdownProps = { target: string };

function difference(target: string) {
  const remaining = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    complete: remaining === 0,
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
  };
}

export function Countdown({ target }: CountdownProps) {
  const [time, setTime] = useState(() => difference(target));

  useEffect(() => {
    const id = window.setInterval(() => setTime(difference(target)), 30_000);
    return () => window.clearInterval(id);
  }, [target]);

  if (time.complete) {
    return <p className="font-serif text-2xl text-stone-900">תודה שחגגתם איתנו ❤️</p>;
  }

  const units = [
    [time.days, "ימים"],
    [time.hours, "שעות"],
    [time.minutes, "דקות"],
  ] as const;

  return (
    <div className="flex items-center justify-center gap-7" aria-label="ספירה לאחור לחתונה">
      {units.map(([value, label]) => (
        <div key={label} className="min-w-14 text-center">
          <strong className="block font-serif text-3xl font-normal tabular-nums text-stone-950 sm:text-4xl">{value}</strong>
          <span className="mt-1 block text-xs tracking-[0.18em] text-stone-500">{label}</span>
        </div>
      ))}
    </div>
  );
}
