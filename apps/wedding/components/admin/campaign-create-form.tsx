"use client";

import { useState } from "react";

import { createWhatsappCampaignAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/admin/submit-button";

export function CampaignCreateForm({ guestGroups }: { guestGroups: Array<{ name: string; side: "michael" | "shoval" | "unassigned"; count: number }> }) {
  const [confirmed, setConfirmed] = useState(false);
  const sideLabel = (side: "michael" | "shoval" | "unassigned") => side === "michael" ? "הצד של מיכאל" : side === "shoval" ? "הצד של שובל" : "ללא שיוך צד";
  const sideCounts = (side: "michael" | "shoval" | "unassigned") => guestGroups.filter((group) => group.side === side).reduce((sum, group) => sum + group.count, 0);
  return (
    <form action={createWhatsappCampaignAction} className="grid gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold">שם הקמפיין<input name="name" required maxLength={120} defaultValue="שליחת הזמנה" className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-semibold">סוג הודעה<select name="messageKind" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="invitation">הזמנה ראשונית</option><option value="reminder">תזכורת</option><option value="event_details">פרטי האירוע</option><option value="table_assignment">מספר שולחן</option><option value="thank_you">תודה</option></select></label>
        <label className="grid gap-2 text-sm font-semibold">קהל<select name="audience" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="all_contactable">כל בעלי המספר התקין</option><option value="pending_rsvp">ממתינים לתשובה</option><option value="confirmed">אישרו הגעה</option><option value="declined">לא מגיעים</option></select></label>
        <label className="grid gap-2 text-sm font-semibold">קבוצה / צד<select name="guestGroupSelection" defaultValue="all" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="all">כל הקטגוריות · כל הצדדים</option><option value="uncategorized">ללא קטגוריה · כל הצדדים ({guestGroups.filter((group) => group.name === "").reduce((sum, group) => sum + group.count, 0)} הזמנות)</option>{(["michael", "shoval", "unassigned"] as const).map((side) => <optgroup key={side} label={`${sideLabel(side)} (${sideCounts(side)} הזמנות)`}><option value={`uncategorized:${side}`}>ללא קטגוריה ({guestGroups.find((group) => group.side === side && group.name === "")?.count ?? 0})</option>{guestGroups.filter((group) => group.side === side && group.name !== "").map((group) => <option key={`${side}:${group.name}`} value={`group:${side}:${encodeURIComponent(group.name)}`}>{group.name} ({group.count} הזמנות)</option>)}</optgroup>)}</select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">השהיה מינימלית בשניות<input name="minDelaySeconds" type="number" min={30} max={900} defaultValue={55} className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-semibold">השהיה מרבית בשניות<input name="maxDelaySeconds" type="number" min={30} max={1800} defaultValue={110} className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">אפשר לשלב קבוצה עם סטטוס הגעה. המערכת תדלג על מי שסימן שלא ליצור קשר, על מספר לא תקין ועל מי שכבר קיבל בהצלחה את אותו סוג הודעה.</p>
      {confirmed ? <div className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="confirmation" value="queue" /><strong className="text-red-900">אישור זה יוסיף את כל הקהל המתאים לתור שליחה אמיתי.</strong><div className="flex flex-wrap gap-2"><SubmitButton pendingLabel="מכין תור…">אישור והפעלת הקמפיין</SubmitButton><button type="button" onClick={() => setConfirmed(false)} className="min-h-11 px-4 text-sm font-semibold underline">ביטול</button></div></div> : <button type="button" onClick={() => setConfirmed(true)} className="min-h-12 w-fit rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">המשך לתצוגת אישור</button>}
    </form>
  );
}
