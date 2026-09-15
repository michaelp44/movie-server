"use client";

import { useActionState } from "react";
import { ArrowLeft } from "lucide-react";
import { identifyGuest, type GuestLoginState } from "@/app/actions/guest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";

const initialState: GuestLoginState = { status: "idle", message: "" };

export function GuestLoginForm({ enabled = true }: { enabled?: boolean }) {
  const [state, action, pending] = useActionState(identifyGuest, initialState);

  return (
    <form action={action} className="mx-auto mt-10 rounded-[1.75rem] border border-stone-900/10 bg-white/72 p-5 text-right shadow-[0_24px_70px_rgba(47,39,27,0.09)] backdrop-blur-md sm:p-6">
      <h2 className="text-xl font-semibold">מי אתם? ❤️</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">הכניסו את מספר הטלפון שלכם ונזהה את ההזמנה שלכם</p>
      <fieldset disabled={!enabled}>
        <label htmlFor="phone" className="mt-5 block text-sm font-semibold">מספר טלפון</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            aria-describedby="phone-message"
            placeholder="050-123-4567"
            className="text-right"
          />
          <Button type="submit" size="lg" disabled={pending || !enabled} className="rounded-2xl sm:min-w-40">
            {pending ? "מזהים אתכם…" : "כניסה לאתר"}
            {!pending && <ArrowLeft aria-hidden="true" size={17} />}
          </Button>
        </div>
      </fieldset>
      <p id="phone-message" aria-live="polite" className="mt-3 min-h-5 text-sm leading-5 text-red-800">
        {enabled ? state.message : "זיהוי ההזמנות ייפתח בקרוב. בינתיים כל פרטי האירוע זמינים בתפריט ❤️"}
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">המספר משמש לזיהוי ההזמנה בלבד ואינו מוצג באתר.</p>
    </form>
  );
}
