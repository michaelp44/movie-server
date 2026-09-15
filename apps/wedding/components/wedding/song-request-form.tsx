"use client";

import { useActionState } from "react";
import { Music2 } from "lucide-react";
import { submitSongRequest, type SubmissionState } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";

const initialState: SubmissionState = { status: "idle", message: "" };

export function SongRequestForm({
  defaultName = "",
  enabled = true,
}: {
  defaultName?: string;
  enabled?: boolean;
}) {
  const [state, action, pending] = useActionState(submitSongRequest, initialState);

  return (
    <form action={action} className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-5 text-white shadow-[0_24px_70px_rgba(24,20,15,.18)] sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-[#d7bb88]">
          <Music2 aria-hidden="true" size={22} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">איזה שיר חייב להיות במסיבה? 🎵</h2>
          <p className="mt-1 text-sm leading-6 text-white/60">תנו לנו את השיר שירים אתכם מהכיסא</p>
        </div>
      </div>
      <fieldset disabled={!enabled} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="song-name" className="mb-2 block text-sm font-semibold">השם שלכם</label>
          <Input id="song-name" name="displayName" defaultValue={defaultName} required maxLength={80} className="border-white/15 bg-white/10 text-white placeholder:text-white/35 focus:border-[#d7bb88]" />
        </div>
        <div>
          <label htmlFor="song" className="mb-2 block text-sm font-semibold">שם השיר</label>
          <Input id="song" name="song" required maxLength={160} placeholder="למשל: Dancing Queen" className="border-white/15 bg-white/10 text-white placeholder:text-white/35 focus:border-[#d7bb88]" />
        </div>
        <div>
          <label htmlFor="artist" className="mb-2 block text-sm font-semibold">אמן / להקה</label>
          <Input id="artist" name="artist" required maxLength={160} placeholder="למשל: ABBA" className="border-white/15 bg-white/10 text-white placeholder:text-white/35 focus:border-[#d7bb88]" />
        </div>
      </fieldset>
      <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="champagne" disabled={pending || !enabled}>
          {pending ? "מוסיפים לפלייליסט…" : "שליחת השיר"}
        </Button>
        <p aria-live="polite" className={`text-sm ${state.status === "error" ? "text-red-300" : "text-[#d7bb88]"}`}>
          {enabled ? state.message : "בקשות השירים ייפתחו בקרוב 🎵"}
        </p>
      </div>
    </form>
  );
}
