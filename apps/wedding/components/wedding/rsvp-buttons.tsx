"use client";

import { useFormStatus } from "react-dom";

export function RsvpButtons({ currentlyConfirmed, canConfirm = true }: { currentlyConfirmed: boolean; canConfirm?: boolean }) {
  const { pending } = useFormStatus();
  return <div className="grid gap-3 sm:grid-cols-2">
    <button disabled={pending || !canConfirm} type="submit" name="status" value="confirmed" data-track="rsvp_confirmed_selected" className="min-h-14 rounded-2xl bg-[#1d1b18] px-5 text-base font-bold text-white transition hover:bg-black disabled:opacity-60">{pending ? "שומרים…" : "מגיעים בשמחה ❤️"}</button>
    <button disabled={pending} type="submit" name="status" value="declined" data-track="rsvp_declined_selected" formNoValidate onClick={(event) => { if (currentlyConfirmed && !window.confirm("לשנות את התשובה ל׳לא מגיעים׳?")) event.preventDefault(); }} className="min-h-14 rounded-2xl border border-black/15 bg-white px-5 text-base font-bold transition hover:bg-black/5 disabled:opacity-60">לצערנו לא נגיע</button>
  </div>;
}
