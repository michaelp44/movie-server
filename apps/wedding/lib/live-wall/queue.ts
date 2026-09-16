export type WallItem = {
  id: string;
  kind: "photo" | "blessing" | "photo_blessing";
  displayName: string | null;
  message: string | null;
  mediaUrl: string | null;
  illustrationUrl?: string | null;
  likeCount?: number;
  createdAt: string;
};

export function buildWallQueue(items: WallItem[], previousIds: string[] = []): WallItem[] {
  const recent = new Set(previousIds.slice(-5));
  const fresh = items.filter((item) => !recent.has(item.id));
  const source = fresh.length ? fresh : items;
  const photos = source.filter((item) => item.kind !== "blessing");
  const blessings = source.filter((item) => item.kind === "blessing");
  const queue: WallItem[] = [];
  while (photos.length || blessings.length) {
    const preferred = queue.at(-1)?.kind === "blessing" ? photos : blessings;
    const fallback = preferred === photos ? blessings : photos;
    const next = preferred.shift() ?? fallback.shift();
    if (next) queue.push(next);
  }
  return queue;
}
