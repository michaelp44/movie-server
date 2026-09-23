export type FaceBox = { x: number; y: number; width: number; height: number; score?: number };

function overlap(a: FaceBox, b: FaceBox): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / Math.max(1, a.width * a.height + b.width * b.height - intersection);
}

export function relevantFaces(width: number, height: number, faces: FaceBox[]): FaceBox[] {
  const credible = faces
    .filter((face) => (face.score ?? 1) >= 0.58 && face.width > 0 && face.height > 0)
    .sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
    .filter((face, index, all) => !all.slice(0, index).some((kept) => overlap(face, kept) > 0.35));
  if (height <= width * 1.2) return credible;
  const upperFaces = credible.filter((face) => face.y + face.height / 2 < height * 0.55);
  return upperFaces.length ? upperFaces : credible;
}

/** A small extra zoom makes room to center faces near the source edges. */
export function centeredFaceCrop(width: number, height: number, cardWidth: number, cardHeight: number, faces: FaceBox[]) {
  faces = relevantFaces(width, height, faces);
  if (!width || !height || !cardWidth || !cardHeight || !faces.length) return null;
  const left = Math.min(...faces.map((face) => face.x));
  const right = Math.max(...faces.map((face) => face.x + face.width));
  const top = Math.min(...faces.map((face) => face.y));
  const bottom = Math.max(...faces.map((face) => face.y + face.height));
  const x = (left + right) / 2;
  const y = (top + bottom) / 2;
  const base = Math.max(cardWidth / width, cardHeight / height);
  const needed = Math.max(base, cardWidth / (2 * Math.max(1, Math.min(x, width - x))), cardHeight / (2 * Math.max(1, Math.min(y, height - y))));
  // Preserve the group and some breathing room; never zoom arbitrarily far.
  const groupLimit = Math.min(cardWidth / ((right - left) * 1.2), cardHeight / ((bottom - top) * 1.2));
  const scale = Math.max(base, Math.min(needed, base * 1.6, groupLimit));
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  return {
    width: `${renderedWidth / cardWidth * 100}%`,
    height: `${renderedHeight / cardHeight * 100}%`,
    left: `${Math.max(cardWidth - renderedWidth, Math.min(0, cardWidth / 2 - x * scale)) / cardWidth * 100}%`,
    top: `${Math.max(cardHeight - renderedHeight, Math.min(0, cardHeight / 2 - y * scale)) / cardHeight * 100}%`,
    maxWidth: "none",
    right: "auto",
    bottom: "auto",
  };
}

/** CSS object-position is relative to overflow, not to the source image. */
export function faceCropPosition(width: number, height: number, cardWidth: number, cardHeight: number, faces: FaceBox[]): string {
  faces = relevantFaces(width, height, faces);
  if (!faces.length || !width || !height || !cardWidth || !cardHeight) return `50% ${height > width * 1.1 ? 10 : 40}%`;
  const scale = Math.max(cardWidth / width, cardHeight / height);
  const left = Math.min(...faces.map((face) => face.x));
  const right = Math.max(...faces.map((face) => face.x + face.width));
  const top = Math.min(...faces.map((face) => face.y));
  const bottom = Math.max(...faces.map((face) => face.y + face.height));
  const position = (start: number, end: number, source: number, viewport: number) => {
    const overflow = source * scale - viewport;
    if (overflow < 1) return 50;
    const offset = ((start + end) / 2) * scale - viewport / 2;
    return Math.max(0, Math.min(100, offset / overflow * 100));
  };
  return `${position(left, right, width, cardWidth)}% ${position(top, bottom, height, cardHeight)}%`;
}
