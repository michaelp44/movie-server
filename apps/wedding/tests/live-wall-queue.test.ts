import { describe, expect, it } from "vitest";
import { buildWallQueue, nextIllustration, type WallItem } from "@/lib/live-wall/queue";

const item = (id: string, kind: WallItem["kind"]): WallItem => ({ id, kind, displayName: null, message: kind === "blessing" ? "ברכה" : null, mediaUrl: kind === "blessing" ? null : "/photo.jpg", createdAt: id });

describe("live wall queue", () => {
  it("rotates illustrations independently of ordinary photo appearances", () => {
    const images = ["a", "b", "c"].map((id) => ({ ...item(id, "photo"), illustrationUrl: "/art.jpg" }));
    const history: string[] = [];
    for (let i = 0; i < 6; i++) history.push(nextIllustration(images, history)!.id);
    expect(history).toEqual(["a", "b", "c", "a", "b", "c"]);
    expect(nextIllustration([...images, { ...item("d", "photo"), illustrationUrl: "/new.jpg" }], history)?.id).toBe("d");
    expect(nextIllustration([item("plain", "photo")], [])).toBeUndefined();
  });
  it("alternates blessings and photos when possible", () => {
    const queue = buildWallQueue([item("3", "photo"), item("2", "blessing"), item("1", "photo")]);
    expect(queue.map((entry) => entry.kind)).toEqual(["blessing", "photo", "photo"]);
  });

  it("avoids recently displayed items when fresh content exists", () => {
    const queue = buildWallQueue([item("new", "photo"), item("old", "blessing")], ["old"]);
    expect(queue.map((entry) => entry.id)).toEqual(["new"]);
  });
});
