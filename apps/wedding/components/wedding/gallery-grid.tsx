import { Camera } from "lucide-react";
import type { ApprovedMedia } from "@/lib/data/guest-interactions";

export function GalleryGrid({ media }: { media: ApprovedMedia[] }) {
  if (!media.length) {
    return (
      <div className="rounded-[2rem] border border-stone-900/10 bg-[#eee6d8] px-6 py-14 text-center">
        <Camera className="mx-auto text-[#9b7845]" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">הגלריה תיפתח אחרי שנתחיל לקבל רגעים מכם</h2>
        <p className="mt-2 text-sm text-stone-600">בינתיים, שמרו את העמוד הזה קרוב ליום החתונה 📸</p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-3 sm:columns-3" aria-label="גלריית החתונה">
      {media.map((item) => (
        <figure key={item.id} className="mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-stone-200">
          {item.kind === "video" ? (
            <video src={item.url} controls preload="metadata" className="h-auto w-full" aria-label="סרטון מהחתונה" />
          ) : (
            // Short-lived private signed URLs are intentionally rendered directly.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.alt} loading="lazy" decoding="async" className="h-auto w-full transition duration-500 hover:scale-[1.015]" />
          )}
        </figure>
      ))}
    </div>
  );
}
