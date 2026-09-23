import { describe, expect, it } from "vitest";
import { centeredFaceCrop, faceCropPosition, relevantFaces } from "../lib/live-wall/face-crop";

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
    expect(faceCropPosition(1000, 2000, 1000, 400, [])).toBe("50% 10%");
  });
  it("ignores false detections on clothing below real faces in portrait photos", () => {
    const faces = relevantFaces(2880, 5120, [
      { x: 850, y: 620, width: 380, height: 380, score: 0.96 },
      { x: 1500, y: 500, width: 430, height: 430, score: 0.94 },
      { x: 900, y: 3100, width: 520, height: 520, score: 0.87 },
    ]);
    expect(faces).toHaveLength(2);
    expect(Math.max(...faces.map((face) => face.y))).toBe(620);
  });
  it("drops overlapping tile duplicates and weak detections", () => {
    const faces = relevantFaces(1200, 1800, [
      { x: 300, y: 200, width: 250, height: 250, score: 0.95 },
      { x: 310, y: 210, width: 245, height: 245, score: 0.91 },
      { x: 800, y: 900, width: 200, height: 200, score: 0.42 },
    ]);
    expect(faces).toEqual([{ x: 300, y: 200, width: 250, height: 250, score: 0.95 }]);
  });
});
