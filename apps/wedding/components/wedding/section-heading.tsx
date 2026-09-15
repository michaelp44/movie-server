import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  centered?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  aside,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        centered ? "text-center sm:block" : ""
      }`}
    >
      <div className={centered ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow ? (
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#987341]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-balance font-serif text-3xl font-medium leading-tight tracking-[-0.025em] text-stone-950 sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-pretty text-sm leading-7 text-stone-600 sm:text-base">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
