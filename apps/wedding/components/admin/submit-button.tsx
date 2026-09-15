"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "שומר…",
  danger = false,
  confirmMessage,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  danger?: boolean;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
        danger ? "bg-red-700 text-white hover:bg-red-800" : "bg-[#1d1b18] text-white hover:bg-black"
      }`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
