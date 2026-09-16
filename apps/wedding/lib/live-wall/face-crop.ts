export type FaceBox = { x: number; y: number; width: number; height: number };

/** CSS object-position is relative to overflow, not to the source image. */
export function faceCropPosition(width: number, height: number, cardWidth: number, cardHeight: number, faces: FaceBox[]): string {
  if (!faces.length || !width || !height || !cardWidth || !cardHeight) return `50% ${height > width * 1.1 ? 28 : 40}%`;
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
