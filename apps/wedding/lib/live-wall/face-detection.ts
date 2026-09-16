import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { FaceBox } from "./face-crop";

let detector: Promise<FaceDetector> | undefined;
const cache = new Map<string, Promise<FaceBox[]>>();

function getDetector() {
  return detector ??= import("@mediapipe/tasks-vision").then(async ({ FaceDetector, FilesetResolver }) => {
    const files = await FilesetResolver.forVisionTasks("/face-detection");
    return FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/face-detection/blaze_face_short_range.tflite", delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.45,
    });
  }).catch((error) => { detector = undefined; throw error; });
}

/** Local detection only; no photos or face coordinates are sent to an API. */
export function detectPhotoFaces(image: HTMLImageElement): Promise<FaceBox[]> {
  // Signed query parameters change on refresh; the object path identifies the image.
  const key = new URL(image.src, window.location.href).pathname;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const engine = await getDetector();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return [];
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const boxes = engine.detect(canvas).detections.flatMap(({ boundingBox: box }) => box ? [{
      x: box.originX / scale, y: box.originY / scale,
      width: box.width / scale, height: box.height / scale,
    }] : []);
    // Overlapping tiles find small faces in groups that a whole-image pass misses.
    const tile = document.createElement("canvas");
    tile.width = tile.height = 320;
    const tileContext = tile.getContext("2d")!;
    const side = Math.min(image.naturalWidth, image.naturalHeight) * 0.5;
    for (const y of [0, 0.5, 1]) for (const x of [0, 0.5, 1]) {
      const left = x * (image.naturalWidth - side);
      const top = y * (image.naturalHeight - side);
      tileContext.drawImage(image, left, top, side, side, 0, 0, 320, 320);
      for (const { boundingBox: box } of engine.detect(tile).detections) if (box) boxes.push({
        x: left + box.originX * side / 320, y: top + box.originY * side / 320,
        width: box.width * side / 320, height: box.height * side / 320,
      });
      // Let the wall paint between passes; this is done once per cached photo.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    tile.width = tile.height = 0;
    canvas.width = canvas.height = 0;
    return boxes;
  })().catch(() => { cache.delete(key); return []; });
  cache.set(key, pending);
  if (cache.size > 150) cache.delete(cache.keys().next().value!);
  return pending;
}
