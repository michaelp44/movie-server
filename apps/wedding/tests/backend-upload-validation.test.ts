import { describe, expect, it } from "vitest";
import { uploadLimits, validateUploadBatch } from "@/lib/upload/validation";

describe("upload validation", () => {
  it("accepts supported images and short videos and derives trusted extensions", () => {
    const result = validateUploadBatch([
      { name: "IMG_1001.JPEG", type: "image/jpeg", size: 2_000_000 },
      { name: "dance.mov", type: "video/quicktime", size: 20_000_000 },
    ]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.files.map((file) => file.extension)).toEqual(["jpg", "mov"]);
  });

  it("rejects mismatched extensions, unsupported MIME types, excessive sizes and batches", () => {
    expect(validateUploadBatch([{ name: "photo.exe", type: "image/jpeg", size: 100 }]).success).toBe(false);
    expect(validateUploadBatch([{ name: "note.txt", type: "text/plain", size: 100 }]).success).toBe(false);
    expect(validateUploadBatch([{ name: "large.jpg", type: "image/jpeg", size: uploadLimits.maxImageBytes + 1 }]).success).toBe(false);
    expect(validateUploadBatch(Array.from({ length: 11 }, (_, index) => ({ name: `${index}.jpg`, type: "image/jpeg", size: 100 }))).success).toBe(false);
  });
});
