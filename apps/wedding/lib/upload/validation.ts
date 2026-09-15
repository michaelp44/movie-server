import type { ValidatedUpload } from "@/lib/types";

export const uploadLimits = {
  maxFiles: 10,
  maxImageBytes: 25 * 1024 * 1024,
  maxVideoBytes: 50 * 1024 * 1024,
} as const;

const allowedMedia = {
  "image/jpeg": { extension: "jpg", extensions: ["jpg", "jpeg"], mediaKind: "image" },
  "image/png": { extension: "png", extensions: ["png"], mediaKind: "image" },
  "image/webp": { extension: "webp", extensions: ["webp"], mediaKind: "image" },
  "image/heic": { extension: "heic", extensions: ["heic"], mediaKind: "image" },
  "image/heif": { extension: "heif", extensions: ["heif"], mediaKind: "image" },
  "video/mp4": { extension: "mp4", extensions: ["mp4", "m4v"], mediaKind: "video" },
  "video/quicktime": { extension: "mov", extensions: ["mov", "qt"], mediaKind: "video" },
  "video/webm": { extension: "webm", extensions: ["webm"], mediaKind: "video" },
} as const;

export type UploadDescriptor = { name: string; type: string; size: number };
export type UploadValidationResult =
  | { success: true; files: ValidatedUpload[] }
  | { success: false; message: string };

export function storedUploadMatches(input: {
  expectedMimeType: string;
  expectedSize: number;
  actualMimeType: string | null | undefined;
  actualSize: number | null | undefined;
}): boolean {
  if (!input.actualMimeType || !Number.isSafeInteger(input.actualSize) || !input.actualSize) {
    return false;
  }
  const media = allowedMedia[input.actualMimeType as keyof typeof allowedMedia];
  if (!media) return false;
  const maxBytes = media.mediaKind === "video" ? uploadLimits.maxVideoBytes : uploadLimits.maxImageBytes;
  return input.actualMimeType === input.expectedMimeType
    && input.actualSize === input.expectedSize
    && input.actualSize <= maxBytes;
}

export function validateUploadBatch(files: UploadDescriptor[]): UploadValidationResult {
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, message: "בחרו לפחות קובץ אחד להעלאה" };
  }
  if (files.length > uploadLimits.maxFiles) {
    return { success: false, message: `אפשר להעלות עד ${uploadLimits.maxFiles} קבצים בכל פעם` };
  }

  const validated: ValidatedUpload[] = [];
  for (const file of files) {
    if (!file || typeof file.name !== "string" || file.name.length < 1 || file.name.length > 255) {
      return { success: false, message: "אחד משמות הקבצים אינו תקין" };
    }
    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      return { success: false, message: `הקובץ ${file.name} ריק או פגום` };
    }

    const media = allowedMedia[file.type as keyof typeof allowedMedia];
    if (!media) {
      return { success: false, message: `הקובץ ${file.name} אינו בפורמט תמונה או וידאו נתמך` };
    }

    const suppliedExtension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
    if (!suppliedExtension || !(media.extensions as readonly string[]).includes(suppliedExtension)) {
      return { success: false, message: `הסיומת של ${file.name} אינה תואמת לסוג הקובץ` };
    }

    const maxBytes = media.mediaKind === "video" ? uploadLimits.maxVideoBytes : uploadLimits.maxImageBytes;
    if (file.size > maxBytes) {
      return {
        success: false,
        message: media.mediaKind === "video"
          ? `הסרטון ${file.name} גדול מ־50MB`
          : `התמונה ${file.name} גדולה מ־25MB`,
      };
    }

    validated.push({
      mimeType: file.type,
      size: file.size,
      extension: media.extension,
      mediaKind: media.mediaKind,
    });
  }

  return { success: true, files: validated };
}
