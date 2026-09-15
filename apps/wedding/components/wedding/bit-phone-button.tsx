"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function BitPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPhone() {
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
      <button type="button" onClick={copyPhone} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#f4ecdd] px-7 font-bold text-stone-950 transition hover:bg-white active:scale-[0.99] sm:w-auto">
        {copied ? "המספר הועתק ל-Bit" : "העתקת המספר ל-Bit"}
        {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      </button>
      <p className="mt-3 font-mono text-lg tracking-wide text-[#e2c58e]" dir="ltr">{phone}</p>
    </div>
  );
}
