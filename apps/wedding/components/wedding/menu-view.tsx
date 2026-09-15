import Image from "next/image";
import { Leaf, Sparkles, WheatOff } from "lucide-react";
import {
  weddingConfig,
  type DietaryTag,
  type MenuCategory,
} from "@/lib/wedding-config";

const dietaryLabels: Record<DietaryTag, string> = {
  vegan: "טבעוני",
  vegetarian: "צמחוני",
  "gluten-free": "ללא גלוטן",
};

function DietaryIcon({ tag }: { tag: DietaryTag }) {
  if (tag === "gluten-free") return <WheatOff aria-hidden="true" size={13} />;
  return <Leaf aria-hidden="true" size={13} />;
}

function PlaceholderDishImage({ index }: { index: number }) {
  const backgrounds = [
    "bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,.75),transparent_20%),linear-gradient(145deg,#d8c5a6,#a98256)]",
    "bg-[radial-gradient(circle_at_67%_35%,rgba(255,255,255,.65),transparent_18%),linear-gradient(145deg,#bdc4aa,#74816a)]",
    "bg-[radial-gradient(circle_at_40%_67%,rgba(255,255,255,.62),transparent_21%),linear-gradient(145deg,#d5b7a7,#9d6f62)]",
    "bg-[radial-gradient(circle_at_60%_28%,rgba(255,255,255,.72),transparent_19%),linear-gradient(145deg,#d9c9b3,#8f785f)]",
  ];

  return (
    <div className={`relative h-full min-h-48 overflow-hidden ${backgrounds[index % backgrounds.length]}`}>
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 bg-white/18 shadow-[0_16px_45px_rgba(43,34,23,0.18)] backdrop-blur-[1px]" />
      <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/30 bg-stone-950/15 px-3 py-2 text-center text-xs font-medium text-white/90 backdrop-blur-md">
        צילום המנה יתווסף כאן
      </div>
    </div>
  );
}

function MenuCategorySection({ category, index }: { category: MenuCategory; index: number }) {
  return (
    <section id={category.id} className="scroll-mt-28 border-t border-stone-900/10 pt-10 first:border-0 first:pt-0 sm:pt-14">
      <div className="mb-7 max-w-2xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#96713e]">{category.eyebrow}</p>
        <h2 className="mt-2 font-serif text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{category.title}</h2>
        <p className="mt-3 text-sm leading-7 text-stone-600 sm:text-base">{category.description}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {category.items.map((item, itemIndex) => (
          <article
            key={item.name}
            className="group overflow-hidden rounded-[1.65rem] border border-stone-900/9 bg-white/72 shadow-[0_16px_48px_rgba(47,39,28,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(47,39,28,0.1)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {item.image ? (
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.025]"
                />
              ) : (
                <PlaceholderDishImage index={index + itemIndex} />
              )}
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-stone-950">{item.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">{item.description}</p>
              {item.dietaryTags.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="התאמות תזונתיות">
                  {item.dietaryTags.map((tag) => (
                    <li
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#edf0e8] px-2.5 py-1 text-[11px] font-semibold text-[#52604a]"
                    >
                      <DietaryIcon tag={tag} />
                      {dietaryLabels[tag]}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MenuView() {
  const { menu } = weddingConfig;

  return (
    <div>
      {menu.isPlaceholder ? (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-[#b3915d]/20 bg-[#eee3cf]/70 px-4 py-3 text-sm leading-6 text-[#694e2b]">
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{menu.note}</p>
        </div>
      ) : null}

      <nav aria-label="קטגוריות התפריט" className="-mx-5 mb-10 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {menu.categories.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}`}
              className="inline-flex min-h-10 items-center rounded-full border border-stone-900/10 bg-white/65 px-4 text-sm font-semibold text-stone-700 transition hover:border-[#a9854f]/40 hover:text-[#795a30]"
            >
              {category.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-12 sm:space-y-16">
        {menu.categories.map((category, index) => (
          <MenuCategorySection key={category.id} category={category} index={index} />
        ))}
      </div>
    </div>
  );
}
