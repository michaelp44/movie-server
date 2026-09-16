import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-serif text-3xl tracking-tight sm:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">{description}</p> : null}
      </div>
      {action ? <div className="flex [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
