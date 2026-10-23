import { CarFront, MapPin, Navigation, Route } from "lucide-react";
import { weddingConfig } from "@/lib/wedding-config";
import { SectionHeading } from "@/components/wedding/section-heading";
import { WazeDirectionLink } from "@/components/wedding/waze-direction-link";

type DirectionLinkProps = {
  href: string;
  label: string;
  icon: typeof Navigation;
};

function DirectionLink({ href, label, icon: Icon }: DirectionLinkProps) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-13 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-stone-900/10 bg-stone-100/80 px-5 font-semibold text-stone-400 sm:w-auto"
      >
        <Icon aria-hidden="true" size={19} />
        {label} — בקרוב
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 font-semibold text-white shadow-sm transition hover:bg-[#785b34] active:scale-[0.99] sm:w-auto"
    >
      <Icon aria-hidden="true" size={19} />
      {label}
    </a>
  );
}

export function Directions() {
  const { venue, maps } = weddingConfig;

  return (
    <section id="directions" className="scroll-mt-24" aria-labelledby="directions-heading">
      <SectionHeading
        eyebrow="הדרך לחגיגה"
        title="איך מגיעים?"
      />

      <div className="mt-7 overflow-hidden rounded-[2rem] border border-stone-900/10 bg-white/70 shadow-[0_20px_65px_rgba(45,37,25,0.07)]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-56 overflow-hidden bg-[#d9ccb7] p-7 sm:p-9">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.6),transparent_20%),linear-gradient(138deg,rgba(246,242,233,0.3),rgba(112,87,54,0.25))]"
            />
            <div aria-hidden="true" className="absolute -left-8 top-8 h-px w-52 -rotate-12 bg-white/70" />
            <div aria-hidden="true" className="absolute bottom-12 right-0 h-px w-64 rotate-[18deg] bg-stone-900/12" />
            <div className="relative flex h-full min-h-42 items-center justify-center">
              <span className="grid size-20 place-items-center rounded-full border border-white/70 bg-white/65 text-[#89683b] shadow-lg backdrop-blur-sm">
                <MapPin aria-hidden="true" size={31} strokeWidth={1.45} />
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-9 lg:p-11">
            {venue.isPlaceholder ? (
              <p className="mb-5 inline-flex rounded-full bg-[#eee3cf] px-3 py-1 text-xs font-semibold text-[#76572d]">
                פרטי המקום יעודכנו בקרוב
              </p>
            ) : null}
            <h2 id="directions-heading" className="font-serif text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
              {venue.name}
            </h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-stone-600 sm:text-base">
              <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[#9b7845]" size={18} />
              {venue.address}
            </p>

            <div className="my-6 h-px bg-stone-900/8" />

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex gap-3">
                <CarFront aria-hidden="true" className="mt-0.5 shrink-0 text-[#9b7845]" size={19} />
                <div>
                  <h3 className="font-semibold text-stone-900">חניה</h3>
                  <p className="mt-1 leading-6 text-stone-600">{venue.parking}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Route aria-hidden="true" className="mt-0.5 shrink-0 text-[#9b7845]" size={19} />
                <div>
                  <h3 className="font-semibold text-stone-900">כדאי לדעת</h3>
                  <p className="mt-1 leading-6 text-stone-600">{venue.notes || "מידע נוסף יפורסם כאן."}</p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <WazeDirectionLink href={maps.waze} />
              <DirectionLink href={maps.googleMaps} label="פתיחה ב-Google Maps" icon={MapPin} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
