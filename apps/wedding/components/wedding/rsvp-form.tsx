"use client";

import { useState } from "react";

import { submitRsvpAction } from "@/app/actions/rsvp";
import { RsvpButtons } from "@/components/wedding/rsvp-buttons";
import { dietaryOptions, type RsvpDetails } from "@/lib/rsvp/details";

type CountKey = "adults" | "children" | "infants";

const groups: Array<[CountKey, string, string]> = [
  ["adults", "מבוגרים", "מגיל 14"],
  ["children", "ילדים", "גילאי 4–13"],
  ["infants", "קטנטנים", "עד גיל 3"],
];

export function RsvpForm({ token, currentlyConfirmed, confirmedCount, initialNote, initial }: {
  token: string;
  currentlyConfirmed: boolean;
  confirmedCount: number;
  initialNote: string | null;
  initial: RsvpDetails | null;
}) {
  const [counts, setCounts] = useState({
    adults: initial?.adults ?? (currentlyConfirmed ? confirmedCount : 1),
    children: initial?.children ?? 0,
    infants: initial?.infants ?? 0,
  });
  const [transport, setTransport] = useState<"yes" | "no" | "unknown">(initial?.transport ?? "unknown");
  const [dietary, setDietary] = useState<string[]>(initial?.dietary ?? []);
  const total = counts.adults + counts.children + counts.infants;
  const [dietaryCounts, setDietaryCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    dietaryOptions.map(([value]) => [value, initial?.dietaryCounts?.[value] ?? (initial?.dietary.includes(value) ? (initial.adults + initial.children + initial.infants) : 0)]),
  ));

  function changeCount(group: CountKey, delta: number) {
    const next = { ...counts, [group]: Math.max(0, counts[group] + delta) };
    const nextTotal = next.adults + next.children + next.infants;
    setCounts(next);
    setDietaryCounts((currentDietary) => Object.fromEntries(Object.entries(currentDietary).map(([key, value]) => [key, Math.min(value, nextTotal)])));
  }

  function toggleDietary(value: string, checked: boolean) {
    setDietary((current) => checked ? [...current, value] : current.filter((item) => item !== value));
    setDietaryCounts((current) => ({ ...current, [value]: checked ? Math.max(1, total) : 0 }));
  }

  return <form action={submitRsvpAction} className="mt-7 space-y-7">
    <input type="hidden" name="token" value={token} />
    <input type="hidden" name="numberConfirmed" value={total} />
    <input type="hidden" name="adults" value={counts.adults} />
    <input type="hidden" name="children" value={counts.children} />
    <input type="hidden" name="infants" value={counts.infants} />
    <input type="hidden" name="transport" value={transport} />
    <input type="hidden" name="dietaryCounts" value={JSON.stringify(dietaryCounts)} />

    <section aria-labelledby="guest-count-title">
      <h2 id="guest-count-title" className="text-lg font-bold">כמה מכם מגיעים?</h2>
      <div className="mt-4 divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10">
        {groups.map(([key, label, hint]) => <div key={key} className="flex min-h-20 items-center justify-between gap-3 px-4 py-3">
          <div><p className="font-semibold">{label}</p><p className="text-xs text-black/50">{hint}</p></div>
          <div className="flex items-center gap-3" dir="ltr">
            <button type="button" data-track={`count_${key}_decrease`} onClick={() => changeCount(key, -1)} disabled={counts[key] === 0} aria-label={`הפחתת ${label}`} className="grid size-11 place-items-center rounded-xl border border-black/15 text-2xl disabled:opacity-30">−</button>
            <output aria-label={`${label}: ${counts[key]}`} className="min-w-5 text-center text-lg font-bold">{counts[key]}</output>
            <button type="button" data-track={`count_${key}_increase`} onClick={() => changeCount(key, 1)} aria-label={`הוספת ${label}`} className="grid size-11 place-items-center rounded-xl border border-black/15 text-2xl">+</button>
          </div>
        </div>)}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#75572d]">סה״כ מגיעים: {total}</p>
    </section>

    <fieldset>
      <legend className="text-lg font-bold">תצטרכו הסעה?</legend>
      <p className="mt-1 text-sm text-black/55">אנחנו בודקים את הצורך בהסעה; פרטים יישלחו בהמשך.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { value: "yes" as const, label: "כן, נשמח" },
          { value: "no" as const, label: "לא, נסתדר" },
          { value: "unknown" as const, label: "עדיין לא יודעים" },
        ].map((option) => <button key={option.value} type="button" data-track={`transport_${option.value}`} aria-pressed={transport === option.value} onClick={() => setTransport(option.value)} className={`min-h-12 rounded-2xl border px-3 font-semibold transition ${transport === option.value ? "border-[#1d1b18] bg-[#1d1b18] text-white" : "border-black/15 bg-white"}`}>{option.label}</button>)}
      </div>
    </fieldset>

    <fieldset>
      <legend className="text-lg font-bold">העדפות ומגבלות אוכל</legend>
      <p className="mt-1 text-sm text-black/55">בחרו סוגי מנות וציינו לכמה אנשים מכל סוג. אפשר לסמן כמה אפשרויות.</p>
      <div className="mt-3 space-y-2">
        {dietaryOptions.map(([value, label]) => <div key={value} className={`rounded-2xl border p-3 transition ${dietary.includes(value) ? "border-[#a9854f]/60 bg-[#f5ecdc]" : "border-black/10 bg-white"}`}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input type="checkbox" name="dietary" value={value} data-track="dietary_option" checked={dietary.includes(value)} onChange={(event) => toggleDietary(value, event.target.checked)} className="size-5 accent-[#1d1b18]" />
            {label}
          </label>
          {dietary.includes(value) ? <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2 text-sm">
            <span>כמה אנשים?</span>
            <div className="flex items-center gap-3" dir="ltr">
              <button type="button" onClick={() => {
                const next = Math.max(0, dietaryCounts[value] - 1);
                setDietaryCounts((current) => ({ ...current, [value]: next }));
                if (next === 0) setDietary((current) => current.filter((item) => item !== value));
              }} disabled={dietaryCounts[value] === 0} aria-label={`הפחתת מספר ${label}`} className="grid size-9 place-items-center rounded-lg border border-black/15 text-xl disabled:opacity-30">−</button>
              <output aria-label={`${label}: ${dietaryCounts[value] ?? 0}`} className="min-w-5 text-center font-bold">{dietaryCounts[value] ?? 0}</output>
              <button type="button" onClick={() => setDietaryCounts((current) => ({ ...current, [value]: Math.min(total, (current[value] ?? 0) + 1) }))} disabled={dietaryCounts[value] >= total} aria-label={`הוספת מספר ${label}`} className="grid size-9 place-items-center rounded-lg border border-black/15 text-xl disabled:opacity-30">+</button>
            </div>
          </div> : null}
        </div>)}
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold">אלרגיות או מידע חשוב על האוכל <span className="font-normal text-black/45">(לא חובה)</span></span>
        <textarea name="allergyNote" data-track="allergy_note_focus" defaultValue={initial?.allergyNote ?? ""} maxLength={300} rows={2} placeholder="למשל אלרגיה לאגוזים — כתבו למי מהאורחים" className="w-full resize-y rounded-2xl border border-black/15 bg-white px-4 py-3 leading-6" />
        <span className="mt-1 block text-xs text-black/55">במקרה של אלרגיה חמורה, חשוב גם ליצור איתנו קשר ישירות.</span>
      </label>
    </fieldset>

    <label className="block">
      <span className="mb-2 block text-sm font-semibold">עוד משהו שחשוב שנדע? <span className="font-normal text-black/45">(לא חובה)</span></span>
      <textarea name="note" data-track="note_focus" defaultValue={initialNote ?? ""} maxLength={500} rows={2} placeholder="למשל צורך בנגישות או בקשה שנחזור אליכם" className="w-full resize-y rounded-2xl border border-black/15 bg-white px-4 py-3 leading-6" />
    </label>
    <RsvpButtons currentlyConfirmed={currentlyConfirmed} canConfirm={total > 0} />
  </form>;
}
