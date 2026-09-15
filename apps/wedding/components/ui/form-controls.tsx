import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-13 w-full rounded-2xl border border-stone-900/15 bg-white/80 px-4 text-base text-stone-950 shadow-inner shadow-stone-900/[0.025] outline-none transition placeholder:text-stone-400 focus:border-[#a9854f] focus:ring-3 focus:ring-[#a9854f]/10 disabled:cursor-not-allowed disabled:bg-stone-100/80 disabled:text-stone-400",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y rounded-2xl border border-stone-900/15 bg-white/80 px-4 py-3 text-base leading-7 text-stone-950 shadow-inner shadow-stone-900/[0.025] outline-none transition placeholder:text-stone-400 focus:border-[#a9854f] focus:ring-3 focus:ring-[#a9854f]/10 disabled:cursor-not-allowed disabled:bg-stone-100/80 disabled:text-stone-400",
        className,
      )}
      {...props}
    />
  );
});

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-red-800" role="alert">{children}</p>;
}
