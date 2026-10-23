const games = [
  {
    date: '25.06.26',
    host: 'מיכאל',
    area: 'רמת גן',
    time: '20:00',
    checkIns: 5,
    note: 'משחק הפתיחה של ההיסטוריה הזמינה',
  },
  {
    date: '09.07.26',
    host: 'נעם',
    area: 'כפר סבא',
    time: '19:30',
    checkIns: 7,
    note: 'הערב עם הכי הרבה דיווחי סיום',
  },
  {
    date: '23.07.26',
    host: 'אריק',
    area: 'רמות השבים',
    time: '20:00',
    checkIns: 5,
    note: '„הרכב מצומצם אבל איכותי“',
  },
  {
    date: '13.08.26',
    host: 'דן',
    area: 'הוד השרון',
    time: '20:00',
    checkIns: 5,
    note: 'המשחק נסגר סופית רק בערב שלפני',
  },
  {
    date: '03.09.26',
    host: 'נעם',
    area: 'כפר סבא',
    time: '20:00',
    checkIns: 5,
    note: 'נתן „הציל את המצב“ והשלים את המינימום',
  },
] as const;

const activity = [
  { name: 'אריק', messages: 70 },
  { name: 'דן', messages: 48 },
  { name: 'נתן', messages: 41 },
  { name: 'אדיר', messages: 36 },
  { name: 'נעם', messages: 31 },
  { name: 'מיכאל', messages: 19 },
] as const;

const months = [
  { label: 'יוני', count: 1 },
  { label: 'יולי', count: 2 },
  { label: 'אוגוסט', count: 1 },
  { label: 'ספטמבר', count: 1 },
] as const;

function Metric({ value, label, detail, accent }: { value: string; label: string; detail: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
      <div className={`absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl ${accent}`} />
      <div className="relative">
        <p className="text-3xl font-black tracking-tight text-white">{value}</p>
        <p className="mt-1 font-bold text-emerald-300">{label}</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

export default function PokerPage() {
  return (
    <div dir="rtl" className="-mx-4 -my-8 min-h-screen overflow-hidden bg-[#07130f] text-slate-100 sm:-mx-6 lg:-mx-8">
      <div className="relative isolate px-4 py-10 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_75%_15%,rgba(16,185,129,0.22),transparent_35%),radial-gradient(circle_at_15%_5%,rgba(245,158,11,0.14),transparent_28%)]" />

        <header className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                מבוסס על היסטוריית פוקר ביוקר
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
                השולחן<span className="text-emerald-400"> במספרים</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                תמונת מצב של כל ערבי הפוקר שאפשר לאמת מהשיחה: מתי שיחקתם, מי אירח,
                כמה קשה היה לסגור שולחן — ומי החזיק את הקבוצה בחיים.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-slate-400">
              <div className="font-bold text-slate-200">חלון הנתונים</div>
              20.06–29.09.2026 · עודכן 02.10.2026
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric value="5" label="ערבי משחק" detail="משחקים עם אישור מפורש וסימני סיום" accent="bg-emerald-400/30" />
            <Metric value="100%" label="ביום חמישי" detail="חמישי ניצח בכל חמשת המשחקים" accent="bg-amber-400/25" />
            <Metric value="19:54" label="שעת פתיחה ממוצעת" detail="20:00 הייתה השעה הנפוצה: 4 מתוך 5" accent="bg-sky-400/25" />
            <Metric value="14 יום" label="חציון בין משחקים" detail="כשהמומנטום עובד, נפגשים פעם בשבועיים" accent="bg-fuchsia-400/20" />
          </div>
        </header>

        <main className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-12">
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl lg:col-span-7 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Game log</p>
                <h2 className="mt-1 text-2xl font-black text-white">חמשת הערבים ששוחקו</h2>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">27 דיווחי סיום</span>
            </div>

            <div className="mt-6 space-y-3">
              {games.map((game, index) => (
                <article key={game.date} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.05]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-lg font-black text-emerald-950">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="font-black text-white">אצל {game.host}</h3>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-sm text-slate-300">{game.area}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{game.note}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm font-bold text-amber-300">{game.date}</p>
                    <p className="mt-1 text-xs text-slate-500">{game.time} · {game.checkIns} דיווחים</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl lg:col-span-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">The voice of the table</p>
            <h2 className="mt-1 text-2xl font-black text-white">מי מניע את השיחה?</h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">הודעות טקסט, לא מספר משחקים או ניצחונות.</p>

            <div className="mt-6 space-y-4">
              {activity.map((player, index) => (
                <div key={player.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-200"><span className="ml-2 text-slate-600">#{index + 1}</span>{player.name}</span>
                    <span className="font-mono text-xs text-slate-400">{player.messages}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600" style={{ width: `${(player.messages / 70) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-amber-300/10 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100/80">
              <span className="font-black text-amber-300">אריק הוא ה‑MVP של התיאומים:</span> 70 הודעות — כמעט רבע מכל הודעות הטקסט בקבוצה.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 lg:col-span-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">Hosting</p>
            <h2 className="mt-1 text-2xl font-black text-white">מפת המארחים</h2>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['נעם', '2', 'כפר סבא'],
                ['מיכאל', '1', 'רמת גן'],
                ['אריק', '1', 'רמות השבים'],
                ['דן', '1', 'הוד השרון'],
              ].map(([name, count, area]) => (
                <div key={name} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-white">{name}</span>
                    <span className="text-2xl font-black text-sky-300">{count}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{area}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">מוצגים אזורים בלבד — כתובות וקודי כניסה הושמטו בכוונה.</p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-950/80 to-slate-950 p-5 lg:col-span-7 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Conversion funnel</p>
            <h2 className="mt-1 text-2xl font-black text-white">כמה קשה להפוך סקר למשחק?</h2>
            <div className="mt-7 grid grid-cols-3 items-end gap-3 text-center">
              <div>
                <div className="mx-auto flex h-32 max-w-28 items-center justify-center rounded-t-2xl bg-emerald-400/25 text-3xl font-black text-emerald-200">8</div>
                <p className="mt-2 text-xs font-bold text-slate-300">סבבי תיאום</p>
              </div>
              <div>
                <div className="mx-auto flex h-20 max-w-28 items-center justify-center rounded-t-2xl bg-amber-400/25 text-3xl font-black text-amber-200">5</div>
                <p className="mt-2 text-xs font-bold text-slate-300">הפכו למשחק</p>
              </div>
              <div>
                <div className="mx-auto flex h-12 max-w-28 items-center justify-center rounded-t-2xl bg-rose-400/20 text-2xl font-black text-rose-200">2</div>
                <p className="mt-2 text-xs font-bold text-slate-300">בוטלו במפורש</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-slate-300">1 נשאר פתוח בנקודת החיתוך</span>
              <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-slate-300">מינימום שהוגדר בשיחה: 6 שחקנים</span>
              <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-slate-300">7 סקרים נפתחו</span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 lg:col-span-7 sm:p-7">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400">Pace</p>
                <h2 className="mt-1 text-2xl font-black text-white">משחקים לפי חודש</h2>
              </div>
              <span className="text-xs text-slate-500">יוני–ספטמבר 2026</span>
            </div>
            <div className="mt-7 grid h-48 grid-cols-4 items-end gap-4 border-b border-white/10 px-2">
              {months.map((month) => (
                <div key={month.label} className="flex h-full flex-col items-center justify-end">
                  <span className="mb-2 font-mono text-sm font-bold text-white">{month.count}</span>
                  <div className="w-full max-w-20 rounded-t-2xl bg-gradient-to-t from-fuchsia-700 to-fuchsia-400" style={{ height: `${month.count * 52}px` }} />
                  <span className="absolute mt-[13.2rem] text-xs text-slate-400">{month.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 lg:col-span-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Data quality</p>
            <h2 className="mt-1 text-2xl font-black text-white">מה נכלל בחישוב?</h2>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[[310, 'פריטים'], [292, 'הודעות טקסט'], [7, 'סקרים']].map(([value, label]) => (
                <div key={label} className="rounded-xl bg-black/20 px-2 py-3">
                  <div className="text-xl font-black text-white">{value}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <ul className="mt-5 space-y-3 text-xs leading-5 text-slate-400">
              <li className="flex gap-2"><span className="text-emerald-400">✓</span><span>משחק נספר רק כשיש אישור זמן/מארח וגם פעילות של סוף ערב.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400">✓</span><span>„דיווחי סיום” הם שולחים של הודעה מספרית — לא דירוג ולא רווח.</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>הסקרים עצמם לא חשפו את רשימת המצביעים, ולכן אין ניחוש של נוכחות.</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>לא מוצגים טלפונים, כתובות, קודי כניסה, לינקים או תוכן פרטי.</span></li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
