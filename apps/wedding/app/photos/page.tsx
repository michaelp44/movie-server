import type { Metadata } from "next";
import { GalleryGrid } from "@/components/wedding/gallery-grid";
import { PhotoUploader } from "@/components/wedding/photo-uploader";
import { PageShell } from "@/components/wedding/page-shell";
import { getApprovedGallery } from "@/lib/data/guest-interactions";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { parseTableNumber } from "@/lib/table";

export const metadata: Metadata = {
  title: "התמונות שלכם | שובל ומיכאל",
  description: "העלו תמונות וסרטונים מהחתונה של שובל ומיכאל וצפו בגלריה המאושרת.",
};

export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  const rawTable = (await searchParams).table;
  const tableNumber = parseTableNumber(Array.isArray(rawTable) ? rawTable[0] : rawTable);
  const gallery = await getApprovedGallery();
  return (
    <PageShell
      eyebrow="הערב דרך העיניים שלכם"
      title="התמונות שלכם 📸"
      description="צלמתם רגע שאנחנו חייבים לראות? העלו אותו לכאן — בלי להירשם ובלי לשלוח בקבוצות."
    >
      <PhotoUploader
        enabled={isSupabaseAdminConfigured()}
        tableNumber={tableNumber ?? undefined}
      />

      <section className="mt-20" aria-labelledby="gallery-title">
        <p className="text-xs tracking-[0.22em] text-[#9b7845]">רגעים שכבר בחרנו</p>
        <h2 id="gallery-title" className="mb-7 mt-3 text-3xl font-semibold sm:text-5xl">הגלריה שלנו</h2>
        <GalleryGrid media={gallery} />
      </section>
    </PageShell>
  );
}
