import { describe, expect, it } from "vitest";
import { centeredFaceCrop, faceCropPosition } from "../lib/live-wall/face-crop";

describe("face-aware cover crop", () => {
  it("adds bounded zoom to center faces that were pinned near the top", () => {
    const crop = centeredFaceCrop(1000, 1000, 1000, 500, [{ x: 400, y: 100, width: 200, height: 200 }])!;
    const faceY = 200 * parseFloat(crop.height) / 100 * 0.5 + parseFloat(crop.top) / 100 * 500;
    expect(faceY).toBeCloseTo(250);
    expect(parseFloat(crop.width)).toBe(125);
  });
  it("keeps all group faces in view instead of zooming them out of frame", () => {
    const crop = centeredFaceCrop(1000, 1000, 1000, 500, [{ x: 20, y: 100, width: 960, height: 100 }])!;
    expect(parseFloat(crop.width)).toBe(100);
  });
  it("moves a wide portrait crop to the heads rather than the torso", () => {
    const position = faceCropPosition(1000, 2000, 1000, 400, [{ x: 400, y: 200, width: 200, height: 200 }]);
    expect(position).toBe("50% 6.25%");
  });
  it("centers the whole group, not only the first face", () => {
    expect(faceCropPosition(2000, 1000, 500, 1000, [
      { x: 600, y: 200, width: 100, height: 100 },
      { x: 1000, y: 200, width: 100, height: 100 },
    ])).toBe("40% 50%");
  });
  it("clamps at image edges without blank strips", () => {
    expect(faceCropPosition(1000, 2000, 1000, 400, [{ x: 0, y: 0, width: 80, height: 80 }])).toBe("50% 0%");
  });
  it("uses a portrait fallback if faces are undetected", () => {
    expect(faceCropPosition(1000, 2000, 1000, 400, [])).toBe("50% 28%");
  });
});
