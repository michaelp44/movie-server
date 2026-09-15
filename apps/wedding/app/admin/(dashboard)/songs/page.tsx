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
      <form action="/admin/songs" className="mb-6 flex max-w-xl items-end gap-3"><div className="grow"><Field label="חיפוש שיר, אמן או אורח" name="q" type="search" defaultValue={params.q} /></div><button type="submit" className="min-h-11 rounded-xl bg-[#1d1b18] px-5 text-sm font-semibold text-white">חיפוש</button></form>
      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-black/[0.025] text-xs text-black/55"><tr><th className="p-4">שיר</th><th className="p-4">אמן</th><th className="p-4">אורח</th><th className="p-4">נשלח</th><th className="p-4"><span className="sr-only">פעולות</span></th></tr></thead><tbody>{songs.map((song) => <tr key={String(song.id)} className="border-t border-black/10"><td className="p-4 font-semibold">{String(song.song)}</td><td className="p-4">{String(song.artist || "—")}</td><td className="p-4">{String(song.display_name || "אורח")}</td><td className="p-4">{new Date(String(song.created_at)).toLocaleDateString("he-IL")}</td><td className="p-4"><form action={deleteSongRequestAction}><input type="hidden" name="id" value={String(song.id)} /><SubmitButton danger>מחיקה</SubmitButton></form></td></tr>)}</tbody></table>{!songs.length ? <p className="p-10 text-center text-black/50">לא נמצאו בקשות.</p> : null}</div>
    </>
  );
}
