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

function MenuCategorySection({ category }: { category: MenuCategory }) {
  return (
    <section id={category.id} className="scroll-mt-28 border-t border-stone-900/10 pt-10 first:border-0 first:pt-0 sm:pt-14">
      <div className="grid overflow-hidden rounded-[1.75rem] border border-stone-900/10 bg-white/75 shadow-[0_16px_48px_rgba(47,39,28,0.06)] lg:grid-cols-2">
        <div className="relative aspect-[4/3] min-h-56 overflow-hidden lg:aspect-auto lg:min-h-[21rem]">
          <Image
            src={category.image.src}
            alt={category.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <span className="absolute bottom-3 right-3 rounded-full bg-stone-950/55 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm">
            תמונת המחשה · באדיבות 5.91
          </span>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#96713e]">{category.eyebrow}</p>
          <h2 className="mt-2 font-serif text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{category.title}</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600 sm:text-base">{category.description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-x-7 sm:grid-cols-2">
        {category.items.map((item) => (
          <article
            key={item.name}
            className="border-b border-stone-900/10 py-5 first:pt-4"
          >
            <h3 className="text-lg font-semibold text-stone-950">{item.name}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
            {item.dietaryTags.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="התאמות תזונתיות">
                {item.dietaryTags.map((tag) => (
                  <li key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-[#edf0e8] px-2.5 py-1 text-[11px] font-semibold text-[#52604a]">
                    <DietaryIcon tag={tag} />
                    {dietaryLabels[tag]}
                  </li>
                ))}
              </ul>
            ) : null}
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
      {menu.note ? (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-[#b3915d]/20 bg-[#eee3cf]/70 px-4 py-3 text-sm leading-6 text-[#694e2b]">
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{menu.note} <a className="font-semibold underline underline-offset-4" href="https://www.591.co.il/גלריה/" target="_blank" rel="noreferrer">לגלריה הקולינרית של 5.91</a></p>
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
        {menu.categories.map((category) => (
          <MenuCategorySection key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
