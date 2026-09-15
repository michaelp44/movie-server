import { Plus } from "lucide-react";
import { weddingConfig } from "@/lib/wedding-config";

export function FAQ() {
  return (
    <div className="divide-y divide-stone-900/9 overflow-hidden rounded-[1.75rem] border border-stone-900/9 bg-white/65 shadow-[0_16px_55px_rgba(46,38,27,0.05)]">
      {weddingConfig.faq.items.map((item, index) => (
        <details key={item.question} className="group" open={index === 0}>
          <summary className="flex min-h-17 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-stone-900 transition hover:bg-white/70 [&::-webkit-details-marker]:hidden sm:px-7 sm:text-lg">
            <span>{item.question}</span>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eee4d2] text-[#89683a]">
              <Plus aria-hidden="true" size={17} className="transition-transform duration-200 group-open:rotate-45" />
            </span>
          </summary>
          <div className="px-5 pb-6 pl-16 text-sm leading-7 text-stone-600 sm:px-7 sm:pb-7 sm:pl-20 sm:text-base">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
