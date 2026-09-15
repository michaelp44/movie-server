"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { weddingConfig } from "@/lib/wedding-config";

export function ShareSiteButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title: "Shoval & Michael | 10.12.2026", text: "מחכים לחגוג איתכם בחתונה שלנו ❤️", url: weddingConfig.domain };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(weddingConfig.domain);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  };

  return (
    <button type="button" onClick={() => void share()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-900/12 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:border-[#a9854f]/40 hover:text-[#76572d]">
      <Share2 aria-hidden="true" size={18} />
      {copied ? "הקישור הועתק" : "שיתוף האתר"}
    </button>
  );
}
