export default function Loading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#f6f2e9]" aria-label="טוענים את פרטי החתונה">
      <div className="h-[56svh] bg-stone-300" />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="h-28 rounded-[2rem] bg-stone-200" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-[1.5rem] bg-stone-200" />)}
        </div>
      </div>
    </main>
  );
}
