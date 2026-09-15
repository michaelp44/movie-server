import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <input {...props} className="min-h-11 rounded-xl border border-black/15 bg-white px-3 outline-none transition focus:border-[#9a7847]" />
    </label>
  );
}

export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <select {...props} className="min-h-11 rounded-xl border border-black/15 bg-white px-3 outline-none transition focus:border-[#9a7847]">
        {children}
      </select>
    </label>
  );
}
