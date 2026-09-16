import { Download } from "lucide-react";

import { deleteSongRequestAction } from "@/app/actions/admin";
import { Field } from "@/components/admin/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { listSongRequests } from "@/lib/admin";

export default async function AdminSongsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const songs = await listSongRequests(params.q);
  return (
    <>
      <PageHeader title="בקשות שירים" description="רשימת השירים שהאורחים רוצים לשמוע במסיבה." action={<a href="/api/admin/songs.csv" download className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold"><Download className="size-4" />הורדה כ-CSV</a>} />
      <form action="/admin/songs" className="mb-6 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="חיפוש שיר, אמן או אורח" name="q" type="search" defaultValue={params.q} /><button type="submit" className="min-h-12 rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white sm:min-h-11">חיפוש</button></form>
      <section className="grid gap-3 sm:hidden" aria-label="בקשות שירים">
        {songs.map((song) => <article key={String(song.id)} className="rounded-2xl border border-black/10 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{String(song.song)}</h2><p className="mt-1 text-sm text-black/60">{String(song.artist || "אמן לא צוין")}</p></div><form action={deleteSongRequestAction}><input type="hidden" name="id" value={String(song.id)} /><SubmitButton danger>מחיקה</SubmitButton></form></div><p className="mt-4 border-t border-black/10 pt-3 text-xs text-black/50">{String(song.display_name || "אורח")} · {new Date(String(song.created_at)).toLocaleDateString("he-IL")}</p></article>)}
        {!songs.length ? <p className="rounded-2xl border border-dashed border-black/20 p-8 text-center text-black/50">לא נמצאו בקשות.</p> : null}
      </section>
      <div className="hidden overflow-x-auto rounded-2xl border border-black/10 bg-white sm:block"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-black/[0.025] text-xs text-black/55"><tr><th className="p-4">שיר</th><th className="p-4">אמן</th><th className="p-4">אורח</th><th className="p-4">נשלח</th><th className="p-4"><span className="sr-only">פעולות</span></th></tr></thead><tbody>{songs.map((song) => <tr key={String(song.id)} className="border-t border-black/10"><td className="p-4 font-semibold">{String(song.song)}</td><td className="p-4">{String(song.artist || "—")}</td><td className="p-4">{String(song.display_name || "אורח")}</td><td className="p-4">{new Date(String(song.created_at)).toLocaleDateString("he-IL")}</td><td className="p-4"><form action={deleteSongRequestAction}><input type="hidden" name="id" value={String(song.id)} /><SubmitButton danger>מחיקה</SubmitButton></form></td></tr>)}</tbody></table>{!songs.length ? <p className="p-10 text-center text-black/50">לא נמצאו בקשות.</p> : null}</div>
    </>
  );
}
