import { deletePhotoAction, moderatePhotoAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { listAdminPhotos } from "@/lib/admin";

export default async function AdminPhotosPage() {
  const photos = await listAdminPhotos();
  return (
    <>
      <PageHeader title="תמונות וסרטונים" description="קבצים שהאורחים מעלים נשארים פרטיים עד לאישור מפורש. קישורי התצוגה המקדימה פגים אוטומטית." />
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            <div className="aspect-[4/3] bg-black/5">
              {photo.previewUrl && photo.mimeType.startsWith("video/") ? (
                <video src={photo.previewUrl} controls preload="metadata" className="size-full object-cover"><track kind="captions" /></video>
              ) : photo.previewUrl ? (
                // Signed Storage URLs are intentionally not put into Next image config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.previewUrl} alt={`העלאה מאת ${photo.displayName || "אורח"}`} loading="lazy" className="size-full object-cover" />
              ) : <div className="grid size-full place-items-center text-sm text-black/45">אין תצוגה מקדימה</div>}
            </div>
            <div className="p-4">
              <div className="flex justify-between gap-3 text-sm"><strong>{photo.displayName || "אורח מזוהה"}</strong><span className="text-black/50">{(photo.fileSize / 1024 / 1024).toFixed(1)} MB</span></div>
              <p className="mt-1 text-xs text-black/45">{new Date(photo.createdAt).toLocaleString("he-IL")}</p>
              <p className="mt-3 text-xs font-semibold">{photo.approved ? "מאושר לגלריה" : photo.rejected ? "נדחה" : "ממתין לבדיקה"}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 [&_button]:w-full">
                <form action={moderatePhotoAction}><input type="hidden" name="id" value={photo.id} /><input type="hidden" name="decision" value="approve" /><SubmitButton>אישור</SubmitButton></form>
                <form action={moderatePhotoAction}><input type="hidden" name="id" value={photo.id} /><input type="hidden" name="decision" value="reject" /><SubmitButton>דחייה</SubmitButton></form>
                <form action={deletePhotoAction}><input type="hidden" name="id" value={photo.id} /><SubmitButton danger pendingLabel="מוחקים…" confirmMessage="למחוק את הקובץ לצמיתות? לא ניתן לבטל את הפעולה.">מחיקה</SubmitButton></form>
              </div>
            </div>
          </article>
        ))}
        {!photos.length ? <p className="rounded-2xl border border-dashed border-black/20 p-10 text-center text-black/50 sm:col-span-2 xl:col-span-3">עדיין לא הועלו קבצים.</p> : null}
      </section>
    </>
  );
}
