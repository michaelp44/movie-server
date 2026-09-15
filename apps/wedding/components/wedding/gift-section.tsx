import { ExternalLink, Gift, Landmark, LockKeyhole } from "lucide-react";
import { weddingConfig } from "@/lib/wedding-config";
import { BitPhoneButton } from "@/components/wedding/bit-phone-button";

export function GiftSection() {
  const { gift } = weddingConfig;

  return (
    <section className="relative overflow-hidden rounded-[2.25rem] border border-stone-900/9 bg-[#211e19] px-6 py-10 text-[#f8f3e9] shadow-[0_28px_85px_rgba(28,24,18,0.18)] sm:px-10 sm:py-14 lg:px-16 lg:py-16">
      <div aria-hidden="true" className="absolute -left-24 -top-28 size-80 rounded-full border border-[#b7945c]/25" />
      <div aria-hidden="true" className="absolute -left-8 -top-10 size-52 rounded-full border border-[#b7945c]/15" />
      <div aria-hidden="true" className="absolute bottom-0 right-0 h-48 w-48 bg-[radial-gradient(circle_at_bottom_right,rgba(183,148,92,.2),transparent_66%)]" />

      <div className="relative mx-auto max-w-2xl text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-[#d6b97f]/30 bg-white/5 text-[#d8bc84]">
          <Gift aria-hidden="true" size={24} strokeWidth={1.5} />
        </span>
        <p className="mt-6 text-[10px] font-semibold tracking-[0.25em] text-[#d0ae70]">מתנה מכל הלב</p>
        <h2 className="mt-3 text-balance font-serif text-4xl font-medium tracking-[-0.035em] sm:text-5xl">
          רוצים לפנק אותנו?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-7 text-stone-300 sm:text-base sm:leading-8">
          {gift.introduction}
        </p>

        <div className="mt-8">
          {gift.bitUrl ? (
            <a
              href={gift.bitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#f4ecdd] px-7 font-bold text-stone-950 transition hover:bg-white active:scale-[0.99] sm:w-auto"
            >
              שליחת מתנה ב-Bit
              <ExternalLink aria-hidden="true" size={18} />
            </a>
          ) : gift.bitPhone ? (
            <BitPhoneButton phone={gift.bitPhone} />
          ) : (
            <div className="mx-auto max-w-md rounded-xl border border-white/12 bg-white/6 px-5 py-4 text-sm leading-6 text-stone-300">
              קישור ה-Bit יופיע כאן לאחר שיוגדר.
            </div>
          )}
        </div>

        {gift.bankTransfer ? (
          <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-white/12 bg-white/5 p-5 text-right">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#e2c58e]">
              <Landmark aria-hidden="true" size={18} />
              העברה בנקאית
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="text-stone-400">שם המוטב</dt>
              <dd className="select-all text-stone-100">{gift.bankTransfer.beneficiary}</dd>
              <dt className="text-stone-400">בנק</dt>
              <dd className="select-all text-stone-100">{gift.bankTransfer.bank}</dd>
              <dt className="text-stone-400">סניף</dt>
              <dd className="select-all text-stone-100">{gift.bankTransfer.branch}</dd>
              <dt className="text-stone-400">חשבון</dt>
              <dd className="select-all text-stone-100">{gift.bankTransfer.account}</dd>
            </dl>
          </div>
        ) : null}

        <p className="mt-7 inline-flex items-center gap-2 text-xs text-stone-400">
          <LockKeyhole aria-hidden="true" size={14} />
          התשלום מתבצע ישירות ובאופן מאובטח באפליקציית Bit
        </p>
      </div>
    </section>
  );
}
