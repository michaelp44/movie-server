"use client";

import { useMemo, useState } from "react";
import { Phone, PhoneOff, ShieldQuestion } from "lucide-react";

import { saveCallResultAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/admin/submit-button";
import { displayIsraeliPhone, phoneCallHref } from "@/lib/rsvp/phone";

type CallQueueItem = {
  id: string;
  displayName: string;
  normalizedPhone: string;
  numberInvited: number;
  numberConfirmed: number;
  lastCall: { outcome: string; note: string | null; createdAt: string } | null;
};

const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "אין מענה",
  confirmed: "מגיעים",
  declined: "לא מגיעים",
  callback: "לחזור מאוחר יותר",
  wrong_number: "מספר שגוי",
};

export function CallQueue({ items, initialId }: { items: CallQueueItem[]; initialId?: string }) {
  const initialIndex = Math.max(0, items.findIndex((item) => item.id === initialId));
  const [index, setIndex] = useState(initialIndex);
  const [hiddenNumber, setHiddenNumber] = useState(false);
  const [outcome, setOutcome] = useState("no_answer");

  const current = items[index];
  const next = items[(index + 1) % items.length];
  const progress = useMemo(() => items.length ? `${index + 1} מתוך ${items.length}` : "0 מתוך 0", [index, items.length]);

  function setCallPrivacy(hidden: boolean) {
    setHiddenNumber(hidden);
  }

  if (!current) {
    return <div className="rounded-3xl border border-emerald-700/20 bg-emerald-50 p-8 text-center"><p className="text-4xl">✓</p><h2 className="mt-3 text-2xl font-bold">אין כרגע למי להתקשר</h2><p className="mt-2 text-sm text-black/60">כל ההזמנות עם מספר תקין כבר קיבלו מענה או סומנו שלא ליצור קשר.</p></div>;
  }

  return <div className="mx-auto max-w-2xl space-y-4">
    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
      <span className="font-semibold">{progress}</span>
      <button type="button" onClick={() => setIndex((value) => (value + 1) % items.length)} className="min-h-10 rounded-xl border border-black/15 px-4 font-semibold">דלג/י לבא</button>
    </div>

    <section className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-sm">
      <div className="bg-[#1d1b18] p-5 text-white sm:p-7">
        <p className="text-xs font-semibold tracking-[.16em] text-white/55">שיחת אישור הגעה</p>
        <h2 className="mt-2 text-3xl font-bold">{current.displayName}</h2>
        <p className="mt-2 text-white/65">הזמנה עבור עד {current.numberInvited} אורחים · {displayIsraeliPhone(current.normalizedPhone)}</p>
      </div>

      <div className="space-y-5 p-4 sm:p-7">
        {current.lastCall ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><strong>ניסיון קודם:</strong> {OUTCOME_LABELS[current.lastCall.outcome] ?? current.lastCall.outcome} · {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(current.lastCall.createdAt))}{current.lastCall.note ? <span className="block pt-1">{current.lastCall.note}</span> : null}</div> : null}

        <div className="rounded-2xl border border-black/10 bg-[#f8f5ee] p-4">
          <p className="text-sm font-bold">איך המספר יוצג?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCallPrivacy(false)} className={`min-h-12 rounded-xl border px-3 font-semibold ${!hiddenNumber ? "border-emerald-700 bg-emerald-700 text-white" : "border-black/15 bg-white"}`}>מספר רגיל</button>
            <button type="button" onClick={() => setCallPrivacy(true)} className={`min-h-12 rounded-xl border px-3 font-semibold ${hiddenNumber ? "border-[#1d1b18] bg-[#1d1b18] text-white" : "border-black/15 bg-white"}`}>מספר חסוי</button>
          </div>
          {hiddenNumber ? <p className="mt-3 flex gap-2 text-xs leading-5 text-black/55"><ShieldQuestion className="mt-0.5 size-4 shrink-0" />החיוג משתמש בקידומת ‎#31#. יש לבדוק פעם אחת שהמפעיל הסלולרי אכן מסתיר את המספר.</p> : null}
        </div>

        <a href={phoneCallHref(current.normalizedPhone, hiddenNumber)} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-lg font-bold text-white shadow-sm active:scale-[.99]">
          <Phone className="size-6" /> התקשרות אל {displayIsraeliPhone(current.normalizedPhone)}
        </a>

        <div className="rounded-2xl border border-[#a9854f]/25 bg-[#fffaf0] p-4 leading-7">
          <p className="text-sm font-bold text-[#75572d]">תסריט קצר</p>
          <p className="mt-2">היי, זה מיכאל. רציתי לוודא שקיבלתם את ההזמנה לחתונה שלנו ב־10 בדצמבר ולשאול אם תוכלו להגיע וכמה תהיו.</p>
        </div>

        <form action={saveCallResultAction} className="space-y-4 border-t border-black/10 pt-5">
          <input type="hidden" name="invitationId" value={current.id} />
          <input type="hidden" name="nextInvitationId" value={next?.id ?? ""} />
          <label className="grid gap-2 text-sm font-semibold">תוצאת השיחה
            <select name="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} className="min-h-14 rounded-2xl border border-black/15 bg-white px-4 text-base font-normal">
              <option value="no_answer">אין מענה</option>
              <option value="callback">לחזור מאוחר יותר</option>
              <option value="confirmed">מגיעים</option>
              <option value="declined">לא מגיעים</option>
              <option value="wrong_number">מספר שגוי</option>
            </select>
          </label>
          {outcome === "confirmed" ? <label className="grid gap-2 text-sm font-semibold">כמה מגיעים?
            <input name="numberConfirmed" type="number" min={1} required defaultValue={Math.max(1, current.numberConfirmed)} className="min-h-14 rounded-2xl border border-black/15 bg-white px-4 text-base font-normal" />
          </label> : <input type="hidden" name="numberConfirmed" value="0" />}
          <label className="grid gap-2 text-sm font-semibold">הערה <span className="font-normal text-black/45">(לא חובה)</span>
            <textarea name="note" maxLength={500} rows={3} placeholder={outcome === "callback" ? "למשל: לחזור מחר בערב" : "פרטים שחשוב לזכור"} className="rounded-2xl border border-black/15 px-4 py-3 font-normal" />
          </label>
          <div className="grid [&>button]:min-h-14 [&>button]:w-full"><SubmitButton>שמירה ומעבר לאורח הבא</SubmitButton></div>
        </form>
      </div>
    </section>
    <p className="flex items-center justify-center gap-2 text-center text-xs text-black/45"><PhoneOff className="size-4" /> “מספר שגוי” מסמן אוטומטית שלא ליצור קשר נוסף.</p>
  </div>;
}
