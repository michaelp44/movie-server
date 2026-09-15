export default function PhotosLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl animate-pulse px-5 pb-28 pt-24 sm:px-8" aria-label="טוענים את עמוד התמונות">
      <div className="h-3 w-36 rounded bg-stone-300" />
      <div className="mt-5 h-12 w-64 rounded bg-stone-300" />
      <div className="mt-8 h-64 rounded-[2rem] bg-stone-200" />
      <div className="mt-20 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="aspect-[4/5] rounded-2xl bg-stone-200" />)}
      </div>
    </main>
  );
}
