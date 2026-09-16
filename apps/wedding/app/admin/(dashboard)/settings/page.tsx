import { setSiteFlagAction } from "@/app/actions/admin";
import { AdminNotice } from "@/components/admin/notice";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { getSiteSettings } from "@/lib/admin";

function enabled(value: unknown): boolean {
  return value === true || (typeof value === "object" && value !== null && "enabled" in value && (value as { enabled: unknown }).enabled === true);
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [settings, params] = await Promise.all([getSiteSettings(), searchParams]);
  const checks = [
    ["Supabase", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["Google Sheets", Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)],
    ["רשימת מנהלים / תפקיד", Boolean(process.env.ADMIN_EMAILS),],
    ["כתובת האתר", Boolean(process.env.NEXT_PUBLIC_SITE_URL)],
    ["איורי AI למסך החי", Boolean(process.env.OPENAI_API_KEY)],
  ] as const;
  return (
    <>
      <PageHeader title="הגדרות ופרסום" description="דגלי פרסום נשמרים במסד הנתונים ומשפיעים מיידית על חוויית האורחים." />
      <AdminNotice>{params.notice}</AdminNotice>
      <section className="grid gap-4 lg:grid-cols-2">
        <FlagCard name="סידורי הושבה" description="כאשר כבוי, מספרי השולחן נשארים מוסתרים מכל האורחים." settingKey="seating_published" value={enabled(settings.seating_published)} />
        <FlagCard name="גלריה" description="כאשר כבוי, גם תמונות מאושרות אינן מוצגות בגלריה הציבורית." settingKey="gallery_published" value={enabled(settings.gallery_published)} />
        <FlagCard name="רגעים מאוירים במסך החי" description="יוצר מראש איור אלגנטי מכחמישית מהתמונות המאושרות ומשלב אותו מדי פעם בהקרנה. אפשר לכבות מיד בלי להשפיע על התמונות המקוריות." settingKey="live_wall_ai_art" value={enabled(settings.live_wall_ai_art)} activeLabels />
      </section>
      <section className="mt-9 rounded-2xl border border-black/10 bg-white p-6"><h2 className="font-serif text-3xl">מצב חיבורים</h2><p className="mt-1 text-sm text-black/50">מוצג רק אם ההגדרה קיימת; ערכי סודות לעולם אינם נחשפים.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{checks.map(([label, ready]) => <div key={label} className="flex items-center justify-between rounded-xl bg-black/[0.025] p-4"><span>{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{ready ? "מוגדר" : "חסר"}</span></div>)}</div></section>
    </>
  );
}

function FlagCard({ name, description, settingKey, value, activeLabels = false }: { name: string; description: string; settingKey: string; value: boolean; activeLabels?: boolean }) {
  return <article className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-3xl">{name}</h2><p className="mt-2 text-sm leading-6 text-black/55">{description}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${value ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-black/60"}`}>{value ? (activeLabels ? "פעיל" : "מפורסם") : (activeLabels ? "כבוי" : "מוסתר")}</span></div><form action={setSiteFlagAction} className="mt-6"><input type="hidden" name="key" value={settingKey} /><input type="hidden" name="enabled" value={value ? "false" : "true"} /><SubmitButton>{value ? (activeLabels ? "כיבוי" : "השהיית פרסום") : (activeLabels ? "הפעלה" : "פרסום עכשיו")}</SubmitButton></form></article>;
}
