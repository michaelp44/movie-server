"use client";

import { useActionState } from "react";
import { Heart, Send } from "lucide-react";
import { submitGuestbookMessage, type SubmissionState } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";

const initialState: SubmissionState = { status: "idle", message: "" };

export function GuestbookForm({
  defaultName = "",
  enabled = true,
}: {
  defaultName?: string;
  enabled?: boolean;
}) {
  const [state, action, pending] = useActionState(submitGuestbookMessage, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded-[2rem] border border-[#a9854f]/25 bg-[#f0e8d8] px-6 py-10 text-center" role="status">
        <Heart className="mx-auto mb-4 text-[#9c7540]" aria-hidden="true" />
        <h3 className="text-xl font-semibold">תודה שכתבתם לנו</h3>
        <p className="mt-2 text-stone-600">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-[2rem] border border-stone-900/10 bg-white/68 p-5 shadow-[0_18px_60px_rgba(40,33,24,.06)] sm:p-7">
      <fieldset disabled={!enabled} className="grid gap-5">
        <div>
          <label htmlFor="guestbook-name" className="mb-2 block text-sm font-semibold">השם שלכם</label>
          <Input id="guestbook-name" name="displayName" defaultValue={defaultName} autoComplete="name" maxLength={80} required />
        </div>
        <div>
          <label htmlFor="guestbook-message" className="mb-2 block text-sm font-semibold">הברכה שלכם</label>
          <Textarea id="guestbook-message" name="message" rows={5} maxLength={1200} required placeholder="כמה מילים שנשמח לשמור איתנו…" />
        </div>
        <Button type="submit" size="lg" disabled={pending || !enabled} className="w-full sm:w-fit">
          {pending ? "שומרים את הברכה…" : "שליחת הברכה"}
          {!pending && <Send aria-hidden="true" size={17} />}
        </Button>
        <p aria-live="polite" className="min-h-5 text-sm text-red-800">
          {!enabled
            ? "שמירת הברכות תיפתח בקרוב ❤️"
            : state.status === "error"
              ? state.message
              : ""}
        </p>
        <p className="-mt-3 text-xs text-stone-500">הברכות נשמרות אצלנו ואינן מתפרסמות אוטומטית.</p>
      </fieldset>
    </form>
  );
}
