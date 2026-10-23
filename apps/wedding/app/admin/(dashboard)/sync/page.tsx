import Link from "next/link";

import { runGuestSyncAction, verifyGoogleSheetsWriteAccessAction, verifyGoogleSheetsWritebackAction } from "@/app/actions/admin";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import { getRecentSyncRuns } from "@/lib/admin";
import { isGoogleSheetsConfigured } from "@/lib/env";
import { previewWeddingSync, type SyncPreview } from "@/lib/sync";

async function loadPreview(requested: boolean, configured: boolean) {
  if (!requested || !configured) return { preview: null, error: null };
  try {
    return { preview: await previewWeddingSync(), error: null };
  } catch (error) {
    console.error("Google Sheets sync preview failed", error);
    return {
      preview: null,
      error: "לא הצלחנו לקרוא את הגיליון. בדקו שהוא משותף ל-service account ושהטאבים הוגדרו נכון.",
    };
  }
}

export default async function AdminSyncPage({ searchParams }: { searchParams: Promise<{ preview?: string; notice?: string }> }) {
  const params = await searchParams;
  const configured = isGoogleSheetsConfigured();
  const [runs, previewResult] = await Promise.all([
    getRecentSyncRuns(),
    loadPreview(params.preview === "1", configured),
  ]);
  return (
    <>
      <PageHeader
        title="Google Sheets"
        description="הגיליון הוא מקור האמת. תצוגה מקדימה תמיד קוראת את המידע מחדש ואינה משנה הזמנות. רשומות שנעלמו מסומנות לבדיקה ולעולם אינן נמחקות אוטומטית."
        action={configured
          ? <Link href="/admin/sync?preview=1" className="inline-flex min-h-11 items-center rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">הכנת תצוגה מקדימה</Link>
          : <span aria-disabled="true" className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl bg-black/10 px-5 text-sm font-semibold text-black/40">הכנת תצוגה מקדימה</span>}
      />
      <AdminNotice>{params.notice}</AdminNotice>
      {!configured ? <AdminNotice>חיבור Google Sheets עדיין אינו מוגדר. הוסיפו את משתני הסביבה ושתפו את הגיליון עם ה-service account.</AdminNotice> : null}
      {configured ? (
        <div className="mb-6 rounded-2xl border border-black/10 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold">כתיבת אישורי הגעה בחזרה לגיליון</p>
            <p className="mt-1 text-sm text-black/55">בדיקת הרשאה אינה משנה תוכן. בדיקת הקצה כותבת מחדש ערכים קיימים של הזמנה מסונכרנת ללא שינוי בתשובה.</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
            <form action={verifyGoogleSheetsWriteAccessAction}><SubmitButton pendingLabel="בודקים…">בדיקת הרשאה</SubmitButton></form>
            <form action={verifyGoogleSheetsWritebackAction}><SubmitButton pendingLabel="כותבים ובודקים…">בדיקת קצה מוגבלת</SubmitButton></form>
          </div>
        </div>
      ) : null}
      <AdminNotice>{previewResult.error ?? undefined}</AdminNotice>
      {previewResult.preview ? <PreviewPanel preview={previewResult.preview} /> : null}
      <section className="mt-10">
        <h2 className="font-serif text-3xl">יומן סנכרונים</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10 bg-white">
          <table className="w-full min-w-[700px] text-right text-sm">
            <thead className="bg-black/[0.025] text-xs text-black/55"><tr><th className="p-4">זמן</th><th className="p-4">סוג</th><th className="p-4">סטטוס</th><th className="p-4">תוצאות</th><th className="p-4">שגיאה</th></tr></thead>
            <tbody>{runs.map((run) => {
              return <tr key={String(run.id)} className="border-t border-black/10"><td className="p-4" dir="ltr">{new Date(String(run.started_at)).toLocaleString("he-IL")}</td><td className="p-4">{run.mode === "preview" ? "תצוגה" : "החלה"}</td><td className="p-4"><StatusBadge status={String(run.status)} /></td><td className="p-4">{run.addition_count ?? 0} חדשים · {run.update_count ?? 0} עודכנו · {run.error_count ?? 0} שגיאות</td><td className="p-4 text-red-700">{run.error ? String(run.error) : "—"}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PreviewPanel({ preview }: { preview: SyncPreview }) {
  const countCards = [
    ["לעיבוד", preview.counts.processed], ["חדשות", preview.counts.added], ["עדכונים", preview.counts.updated],
    ["ללא שינוי", preview.counts.unchanged], ["חסרות במקור", preview.counts.missing], ["קונפליקטים", preview.counts.conflicts], ["שגיאות מיפוי", preview.counts.errors],
  ];
  return (
    <section className="rounded-3xl border border-[#a9854f]/30 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-black/50">מקור</p><h2 className="font-serif text-3xl">{preview.guestTabNames.join(" + ")}{preview.seatingTabName ? ` + ${preview.seatingTabName}` : ""}</h2></div><p className="text-xs text-black/45" dir="ltr">{new Date(preview.plan.generatedAt).toLocaleString("he-IL")}</p></div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{countCards.map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[#f4f1e9] p-3"><p className="text-xs text-black/55">{label}</p><p className="mt-1 font-serif text-3xl">{value}</p></div>)}</div>
      {(preview.plan.conflicts.length || preview.plan.mappingIssues.length) ? <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">נדרשת בדיקה</p><ul className="mt-2 list-disc space-y-1 pe-5">{preview.plan.conflicts.map((issue, index) => <li key={`c-${index}`}>{issue.message}</li>)}{preview.plan.mappingIssues.map((issue, index) => <li key={`m-${index}`}>{issue.message}</li>)}</ul></div> : null}
      {preview.plan.updates.length ? <details className="mt-6"><summary className="cursor-pointer font-semibold">פירוט עדכונים ({preview.plan.updates.length})</summary><ul className="mt-3 grid gap-2 text-sm">{preview.plan.updates.slice(0, 100).map((item) => <li key={item.id} className="rounded-xl bg-black/[0.025] p-3"><strong>{item.source.displayName}</strong> — {item.changes.map((change) => change.field).join(", ") || "ביטול סימון חסר"}</li>)}</ul></details> : null}
      {preview.plan.missing.length ? <details className="mt-4"><summary className="cursor-pointer font-semibold text-amber-800">חסרים בגיליון ({preview.plan.missing.length})</summary><p className="mt-2 text-sm">הם יסומנו לבדיקה בלבד: {preview.plan.missing.map((item) => item.invitation.displayName).join(", ")}</p></details> : null}
      <form action={runGuestSyncAction} className="mt-7 border-t border-black/10 pt-6"><input type="hidden" name="confirmation" value="apply" /><p className="mb-3 text-xs text-black/50">בלחיצה המערכת תקרא שוב את הגיליון ותחשב תוכנית עדכנית לפני החלה.</p><SubmitButton pendingLabel="מסנכרנים…">סנכרן אורחים מ-Google Sheets</SubmitButton></form>
    </section>
  );
}
