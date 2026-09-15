import type { LucideIcon } from "lucide-react";
import { DoorOpen, Gem, GlassWater, Music2, Sparkles } from "lucide-react";
import { weddingConfig, type TimelineIcon } from "@/lib/wedding-config";

const timelineIcons: Record<TimelineIcon, LucideIcon> = {
  doors: DoorOpen,
  ceremony: Gem,
  dinner: GlassWater,
  party: Music2,
};

export function TimelineView() {
  const { timeline } = weddingConfig;

  return (
    <div>
      {timeline.isPlaceholder ? (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-[#b3915d]/20 bg-[#eee3cf]/70 px-4 py-3 text-sm leading-6 text-[#694e2b]">
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{timeline.note}</p>
        </div>
      ) : null}

      <ol className="relative mx-auto max-w-3xl" aria-label="סדר אירועי הערב">
        {timeline.items.map((item, index) => {
          const Icon = timelineIcons[item.icon];
          const last = index === timeline.items.length - 1;

          return (
            <li key={`${item.time}-${item.title}`} className="relative grid grid-cols-[4.5rem_2.75rem_1fr] gap-3 pb-8 sm:grid-cols-[6rem_3.25rem_1fr] sm:gap-5 sm:pb-10">
              <time
                dateTime={`${weddingConfig.date}T${item.time}:00`}
                className="pt-3 text-left font-serif text-2xl font-medium tabular-nums text-stone-900 sm:text-3xl"
                dir="ltr"
              >
                {item.time}
              </time>

              <div className="relative flex justify-center">
                {!last ? (
                  <span aria-hidden="true" className="absolute top-12 h-[calc(100%+0.5rem)] w-px bg-gradient-to-b from-[#b49360]/70 to-stone-900/8" />
                ) : null}
                <span
                  className={`relative z-10 grid size-11 place-items-center rounded-full border sm:size-13 ${
                    item.featured
                      ? "border-[#aa8753] bg-[#a9854f] text-white shadow-[0_8px_25px_rgba(169,133,79,0.28)]"
                      : "border-stone-900/10 bg-[#fbf8f1] text-[#8c6938]"
                  }`}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.6} />
                </span>
              </div>

              <article
                className={`rounded-[1.5rem] border p-5 sm:p-6 ${
                  item.featured
                    ? "border-[#ae8a55]/25 bg-[#eee3cf]/80 shadow-[0_16px_50px_rgba(60,47,29,0.07)]"
                    : "border-stone-900/9 bg-white/65"
                }`}
              >
                <h2 className="text-lg font-semibold text-stone-950 sm:text-xl">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">{item.description}</p>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
