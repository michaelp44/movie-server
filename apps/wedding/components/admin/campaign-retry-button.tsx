"use client";

import { useState } from "react";

import { retryFailedWhatsappCampaignAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/admin/submit-button";

export function CampaignRetryButton({ campaignId, count, messageLanguage = "auto" }: { campaignId: string; count: number; messageLanguage?: "auto" | "he" | "en" }) {
  const [confirm, setConfirm] = useState(false);

  return confirm ? (
    <form action={retryFailedWhatsappCampaignAction} className="grid w-full gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:w-auto">
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="grid gap-1 text-sm font-semibold">שפת ההודעות
        <select name="messageLanguage" defaultValue={messageLanguage} className="min-h-11 rounded-lg border border-amber-300 bg-white px-3 font-normal">
          <option value="auto">אוטומטית לפי שם</option><option value="en">אנגלית</option><option value="he">עברית</option>
        </select>
      </label>
      <p className="text-sm leading-6 text-amber-950">
        יישלחו רק {count} ההזמנות שנכשלו, בקצב המקורי. ודא שה-Mac מחובר ל-WhatsApp; מי שכבר קיבל את ההודעה ידולג.
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="מכין שליחה חוזרת…">אישור שליחה חוזרת</SubmitButton>
        <button type="button" onClick={() => setConfirm(false)} className="min-h-11 px-3 text-sm underline">ביטול</button>
      </div>
    </form>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className="min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-semibold text-amber-900">
      שליחה חוזרת לנכשלים ({count})
    </button>
  );
}
