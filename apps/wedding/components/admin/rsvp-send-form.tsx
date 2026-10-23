"use client";

import { useState } from "react";

import { sendWeddingWhatsappAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/admin/submit-button";

type MessageKind = "invitation" | "reminder" | "event_details" | "table_assignment" | "thank_you";

const options: Array<[MessageKind, string]> = [
  ["invitation", "הזמנה ראשונית"],
  ["reminder", "תזכורת לאישור"],
  ["event_details", "פרטי האירוע"],
  ["table_assignment", "מספר שולחן"],
  ["thank_you", "תודה אחרי האירוע"],
];

export function RsvpSendForm({
  invitationId,
  displayName,
  defaultKind,
  messages,
  disabledReason,
  returnTo = "/admin/rsvp",
}: {
  invitationId: string;
  displayName: string;
  defaultKind: MessageKind;
  messages: Record<MessageKind, string>;
  disabledReason?: string;
  returnTo?: "/admin/rsvp" | "/admin/rsvp?contact=unsent";
}) {
  const [kind, setKind] = useState<MessageKind>(defaultKind);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  return (
    <form action={sendWeddingWhatsappAction} className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="grid gap-2 text-sm font-semibold">
        סוג ההודעה
        <select name="messageKind" value={kind} onChange={(event) => { setKind(event.target.value as MessageKind); setSendConfirmed(false); }} className="min-h-12 rounded-xl border border-black/15 bg-white px-3 font-normal">
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div>
        <p className="mb-2 text-xs font-semibold text-black/55">זה הטקסט שיישלח</p>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-xl border border-black/10 bg-white p-3 font-sans text-xs leading-5">{messages[kind]}</pre>
      </div>
      <div>
        {disabledReason ? <p className="mb-2 max-w-48 text-xs font-medium text-red-700">{disabledReason}</p> : null}
        <fieldset disabled={Boolean(disabledReason)}>
          {sendConfirmed ? (
            <div className="grid gap-2">
              <p className="max-w-52 text-xs font-semibold text-amber-800">ההודעה תישלח עכשיו אל {displayName}.</p>
              <SubmitButton pendingLabel="שולח…">אישור ושליחה</SubmitButton>
              <button type="button" onClick={() => setSendConfirmed(false)} className="min-h-10 text-sm font-semibold text-black/55 underline">ביטול</button>
            </div>
          ) : (
            <button type="button" onClick={() => setSendConfirmed(true)} className="min-h-12 rounded-xl bg-[#1d1b18] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60">שליחה ב-WhatsApp</button>
          )}
        </fieldset>
      </div>
    </form>
  );
}
