import { describe, expect, it } from "vitest";
import { buildWallQueue, type WallItem } from "@/lib/live-wall/queue";

const item = (id: string, kind: WallItem["kind"]): WallItem => ({ id, kind, displayName: null, message: kind === "blessing" ? "ברכה" : null, mediaUrl: kind === "blessing" ? null : "/photo.jpg", createdAt: id });

describe("live wall queue", () => {
  it("alternates blessings and photos when possible", () => {
    const queue = buildWallQueue([item("3", "photo"), item("2", "blessing"), item("1", "photo")]);
    expect(queue.map((entry) => entry.kind)).toEqual(["blessing", "photo", "photo"]);
  });

  it("avoids recently displayed items when fresh content exists", () => {
    const queue = buildWallQueue([item("new", "photo"), item("old", "blessing")], ["old"]);
    expect(queue.map((entry) => entry.id)).toEqual(["new"]);
  });
});
