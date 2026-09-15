import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
