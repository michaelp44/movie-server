import Image from "next/image";
import { Camera, Sparkles } from "lucide-react";
import { weddingConfig } from "@/lib/wedding-config";

export function StoryView() {
  const { story } = weddingConfig;

  return (
    <div>
      {story.isPlaceholder ? (
        <div className="mb-10 flex items-start gap-3 rounded-2xl border border-[#b3915d]/20 bg-[#eee3cf]/70 px-4 py-3 text-sm leading-6 text-[#694e2b]">
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{story.introduction}</p>
        </div>
      ) : (
        <p className="mx-auto mb-12 max-w-2xl text-center text-base leading-8 text-stone-600">{story.introduction}</p>
      )}

      <ol className="space-y-12 sm:space-y-20" aria-label="הסיפור של שובל ומיכאל">
        {story.entries.map((entry, index) => {
          const mediaFirst = index % 2 === 0;

          return (
            <li key={entry.id} className="grid items-center gap-7 lg:grid-cols-2 lg:gap-14">
              <div className={`relative ${mediaFirst ? "lg:order-1" : "lg:order-2"}`}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-stone-900/8 bg-[#d7cab6] shadow-[0_26px_75px_rgba(42,34,23,0.1)]">
                  {entry.image ? (
                    <Image
                      src={entry.image.src}
                      alt={entry.image.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_22%,rgba(255,255,255,.72),transparent_24%),linear-gradient(145deg,#ddd2c2,#9c8467)]">
                      <div aria-hidden="true" className="absolute inset-6 rounded-t-[9rem] border border-white/45" />
                      <div className="absolute inset-x-7 bottom-7 flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-xs font-medium text-white backdrop-blur-md">
                        <Camera aria-hidden="true" size={16} />
                        התמונה שלנו תתווסף כאן
                      </div>
                    </div>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-5 -left-2 font-serif text-8xl font-medium leading-none text-[#b18d56]/16 sm:-left-7 sm:text-9xl"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <article className={`relative px-1 py-2 sm:px-5 ${mediaFirst ? "lg:order-2" : "lg:order-1"}`}>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#96713e]">{entry.date}</p>
                <h2 className="mt-3 text-balance font-serif text-4xl font-medium leading-tight tracking-[-0.035em] sm:text-5xl">
                  {entry.title}
                </h2>
                <div className="my-5 h-px w-14 bg-[#b69460]" />
                <p className="text-pretty text-base leading-8 text-stone-600 sm:text-lg sm:leading-9">{entry.story}</p>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
