import Link from "next/link";
import Image from "next/image";
import { moderateLiveWallAction, setLiveWallControlAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { getSiteSettings, listLiveWallItems } from "@/lib/admin";

const labels = { PENDING: "ממתין", APPROVED: "מאושר", NEEDS_REVIEW: "דורש בדיקה", BLOCKED: "חסום" } as const;

export default async function AdminLiveWallPage() {
  const [items, settings] = await Promise.all([listLiveWallItems(), getSiteSettings()]);
  return <>
    <PageHeader title="מסך החתונה החי" description="אישור אוטומטי, בדיקה מהירה ושליטה מיידית במה שמוצג באולם." />
    <section className="mb-7 flex flex-wrap gap-2 rounded-2xl border border-black/10 bg-white p-4">
      <Link href="/live" target="_blank" className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">פתיחת מסך ההקרנה</Link>
      <Control keyName="live_wall_enabled" value={settings.live_wall_enabled === false} label={settings.live_wall_enabled === false ? "הפעלת המסך" : "כיבוי המסך"} />
      <Control keyName="live_wall_paused" value={settings.live_wall_paused !== true} label={settings.live_wall_paused === true ? "המשך סיבוב" : "השהיית סיבוב"} />
      <Control keyName="live_wall_blank" value={settings.live_wall_blank !== true} label={settings.live_wall_blank === true ? "החזרת המסך" : "מסך שחור בחירום"} danger={settings.live_wall_blank !== true} />
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={`${item.kind}:${item.id}`} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      {item.previewUrl ? <div className="relative aspect-[4/3] bg-black/5"><Image src={item.previewUrl} alt="תוכן שהועלה" fill unoptimized sizes="(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /></div> : null}
      <div className="p-4"><div className="flex items-start justify-between gap-3"><strong>{item.displayName || "אורח"}</strong><span className="rounded-full bg-black/5 px-2 py-1 text-xs">{labels[item.status]}</span></div>
        {item.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.message}</p> : null}
        <p className="mt-3 text-xs text-black/45">{new Date(item.createdAt).toLocaleString("he-IL")}{item.hiddenAt ? " · מוסתר מהמסך" : ""}</p>
        {item.reason ? <p className="mt-2 line-clamp-2 text-xs text-black/45">בדיקה: {item.reason}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}%` : ""}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2"><Action item={item} action="approve" label="אישור" /><Action item={item} action="block" label="דחייה" />{item.hiddenAt ? <Action item={item} action="restore" label="שחזור" /> : <Action item={item} action="hide" label="הסתרה" />}<Action item={item} action="delete" label="מחיקה" danger /></div>
      </div></article>)}{!items.length ? <p className="rounded-2xl border border-dashed border-black/20 p-10 text-center text-black/50 sm:col-span-2 xl:col-span-3">אין עדיין תוכן למסך.</p> : null}</div>
  </>;
}

function Control({ keyName, value, label, danger = false }: { keyName: string; value: boolean; label: string; danger?: boolean }) {
  return <form action={setLiveWallControlAction}><input type="hidden" name="key" value={keyName} /><input type="hidden" name="value" value={String(value)} /><SubmitButton danger={danger}>{label}</SubmitButton></form>;
}

function Action({ item, action, label, danger = false }: { item: { id: string; kind: string }; action: string; label: string; danger?: boolean }) {
  return <form action={moderateLiveWallAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value={item.kind} /><input type="hidden" name="moderationAction" value={action} /><SubmitButton danger={danger} confirmMessage={action === "delete" ? "למחוק לצמיתות?" : undefined}>{label}</SubmitButton></form>;
}
