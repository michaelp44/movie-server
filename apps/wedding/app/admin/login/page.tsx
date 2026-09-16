import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loginAdminAction } from "@/app/actions/admin-auth";
import { SubmitButton } from "@/components/admin/submit-button";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "כניסת מנהלים", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAuthenticatedAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const configured = isSupabaseAdminConfigured();
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-5">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_24px_80px_rgba(34,29,20,0.08)] sm:p-10">
        <p className="font-serif text-lg text-[#9a7847]">Shoval &amp; Michael</p>
        <h1 className="mt-3 font-serif text-4xl">כניסה לניהול</h1>
        <p className="mt-2 text-sm leading-6 text-black/55">הכניסה מיועדת למנהלי האתר בלבד ומאובטחת באמצעות Supabase Auth.</p>
        {!configured ? (
          <p role="status" className="mt-5 rounded-xl border border-[#b08a50]/25 bg-[#fffaf0] p-3 text-sm leading-6 text-[#6d512c]">
            מערכת הניהול עדיין ממתינה לחיבור Supabase המלא.
          </p>
        ) : null}
        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <form action={loginAdminAction} className="mt-7 grid gap-4">
          <fieldset disabled={!configured} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              שם משתמש
              <input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="min-h-12 rounded-xl border border-black/15 px-3 disabled:cursor-not-allowed disabled:bg-black/5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              סיסמה
              <input name="password" type="password" autoComplete="current-password" required className="min-h-12 rounded-xl border border-black/15 px-3 disabled:cursor-not-allowed disabled:bg-black/5" />
            </label>
            <SubmitButton pendingLabel="מתחברים…">כניסה</SubmitButton>
          </fieldset>
        </form>
      </section>
    </main>
  );
}
