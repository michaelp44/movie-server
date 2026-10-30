"use client";

import { useState } from "react";

import { createWhatsappCampaignAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/admin/submit-button";

type GuestGroup = { name: string; side: "michael" | "shoval" | "unassigned"; count: number };
type Side = GuestGroup["side"];

const sides: Side[] = ["michael", "shoval", "unassigned"];
const sideLabel = (side: Side) => side === "michael" ? "הצד של מיכאל" : side === "shoval" ? "הצד של שובל" : "ללא שיוך צד";

export function CampaignCreateForm({ guestGroups }: { guestGroups: GuestGroup[] }) {
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const uncategorizedCount = guestGroups.filter((group) => !group.name).reduce((sum, group) => sum + group.count, 0);

  function toggle(value: string) {
    setSelected((current) => value === "all"
      ? current.includes("all") ? [] : ["all"]
      : current.includes(value) ? current.filter((item) => item !== value && item !== "all") : [...current.filter((item) => item !== "all"), value]);
  }

  return (
    <form action={createWhatsappCampaignAction} className="grid gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
      {selected.map((value) => <input key={value} type="hidden" name="guestGroupSelections" value={value} />)}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold">שם הקמפיין<input name="name" required maxLength={120} defaultValue="שליחת הזמנה" className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-semibold">סוג הודעה<select name="messageKind" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="invitation">הזמנה ראשונית</option><option value="reminder">תזכורת</option><option value="event_details">פרטי האירוע</option><option value="table_assignment">מספר שולחן</option><option value="thank_you">תודה</option></select></label>
        <label className="grid gap-2 text-sm font-semibold">קהל לפי אישור הגעה<select name="audience" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="all_contactable">כל בעלי המספר התקין</option><option value="pending_rsvp">ממתינים לתשובה</option><option value="confirmed">אישרו הגעה</option><option value="declined">לא מגיעים</option></select></label>
        <label className="grid gap-2 text-sm font-semibold">שפת ההודעה<select name="messageLanguage" defaultValue="auto" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal"><option value="auto">לפי שם המוזמן</option><option value="en">אנגלית</option><option value="he">עברית</option></select></label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">קבוצות וקהל <span className="font-normal text-black/55">· אפשר לבחור כמה קבוצות, גם מצדדים שונים</span></legend>
        <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${selected.includes("all") ? "border-[#9f8554] bg-[#fbf8ef]" : "border-black/10"}`}>
          <input type="checkbox" checked={selected.includes("all")} onChange={() => toggle("all")} className="size-5 accent-[#9f8554]" />
          <span className="font-semibold">כל הקטגוריות · כל הצדדים</span>
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          {sides.map((side) => {
            const groups = guestGroups.filter((group) => group.side === side && group.name);
            const uncategorized = guestGroups.find((group) => group.side === side && !group.name)?.count ?? 0;
            return <section key={side} className="rounded-xl border border-black/10 p-3">
              <h3 className="mb-2 text-sm font-semibold">{sideLabel(side)}</h3>
              <div className="grid gap-1.5">
                <GroupChoice value={`uncategorized:${side}`} name="ללא קטגוריה" count={uncategorized} selected={selected.includes(`uncategorized:${side}`)} disabled={selected.includes("all")} onChange={toggle} />
                {groups.map((group) => {
                  const value = `group:${side}:${encodeURIComponent(group.name)}`;
                  return <GroupChoice key={value} value={value} name={group.name} count={group.count} selected={selected.includes(value)} disabled={selected.includes("all")} onChange={toggle} />;
                })}
              </div>
            </section>;
          })}
        </div>
        <p aria-live="polite" className="text-xs text-black/55">{selected.includes("all") ? "נבחר כל הקהל." : selected.length ? `נבחרו ${selected.length} קבוצות.` : `לא נבחר קהל. כל הקטגוריות יחד כוללות ${guestGroups.reduce((sum, group) => sum + group.count, 0)} הזמנות; מתוכן ${uncategorizedCount} ללא קטגוריה.`}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">השהיה מינימלית בשניות<input name="minDelaySeconds" type="number" min={30} max={900} defaultValue={55} className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-semibold">השהיה מרבית בשניות<input name="maxDelaySeconds" type="number" min={30} max={1800} defaultValue={110} className="min-h-12 rounded-xl border border-black/15 px-3 font-normal" /></label>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">אפשר לשלב כמה קבוצות עם סטטוס הגעה. המערכת תדלג על מי שסימן שלא ליצור קשר, על מספר לא תקין ועל מי שכבר קיבל בהצלחה את אותו סוג הודעה.</p>
      {confirmed ? <div className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="confirmation" value="queue" /><strong className="text-red-900">אישור זה יוסיף את כל הקהל המתאים לתור שליחה אמיתי.</strong><div className="flex flex-wrap gap-2"><SubmitButton pendingLabel="מכין תור…">אישור והפעלת הקמפיין</SubmitButton><button type="button" onClick={() => setConfirmed(false)} className="min-h-11 px-4 text-sm font-semibold underline">ביטול</button></div></div> : <button type="button" disabled={!selected.length} onClick={() => setConfirmed(true)} className="min-h-12 w-fit rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">המשך לתצוגת אישור</button>}
    </form>
  );
}

function GroupChoice({ value, name, count, selected, disabled, onChange }: { value: string; name: string; count: number; selected: boolean; disabled: boolean; onChange: (value: string) => void }) {
  return <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-[#f8f6f0] ${disabled ? "opacity-45" : ""}`}>
    <input type="checkbox" checked={selected} disabled={disabled || count === 0} onChange={() => onChange(value)} className="size-4 accent-[#9f8554]" />
    <span className="flex-1">{name || "ללא קטגוריה"}</span><span className="text-xs tabular-nums text-black/55">{count}</span>
  </label>;
}
