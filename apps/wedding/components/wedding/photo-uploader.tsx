"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Film, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

type SelectedFile = { file: File; preview: string };
type UploadState = { phase: "ready" | "uploading" | "success" | "error"; progress: number; message: string };

async function optimizeImage(file: File): Promise<File> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size < 1_500_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return blob && blob.size < file.size
    ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified })
    : file;
}

function clientValidate(files: File[]) {
  if (files.length > 10) return "אפשר להעלות עד 10 קבצים בכל פעם";
  for (const file of files) {
    if (!acceptedTypes.has(file.type)) return `הקובץ ${file.name} אינו בפורמט נתמך`;
    const limit = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > limit) return file.type.startsWith("video/")
      ? `הסרטון ${file.name} גדול מ־50MB`
      : `התמונה ${file.name} גדולה מ־25MB`;
  }
  return null;
}

function uploadWithProgress(url: string, file: File, onProgress: (value: number) => void, backend: "supabase" | "fallback") {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    if (backend === "supabase") request.setRequestHeader("x-upsert", "false");
    else request.setRequestHeader("content-type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Upload failed (${request.status})`));
    });
    request.addEventListener("error", () => reject(new Error("Network upload error")));
    if (backend === "fallback") request.send(file);
    else {
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      request.send(body);
    }
  });
}

export function PhotoUploader({
  enabled = true,
  tableNumber,
}: {
  enabled?: boolean;
  tableNumber?: string;
}) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [state, setState] = useState<UploadState>({ phase: "ready", progress: 0, message: "" });
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => () => {
    previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewUrlsRef.current.clear();
  }, []);

  function revokePreview(preview: string) {
    URL.revokeObjectURL(preview);
    previewUrlsRef.current.delete(preview);
  }

  function selectFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    const error = clientValidate(next);
    if (error) {
      setState({ phase: "error", progress: 0, message: error });
      return;
    }
    files.forEach((item) => revokePreview(item.preview));
    const selected = next.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrlsRef.current.add(preview);
      return { file, preview };
    });
    setFiles(selected);
    setState({ phase: "ready", progress: 0, message: "" });
  }

  function remove(index: number) {
    setFiles((current) => {
      revokePreview(current[index]!.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function upload() {
    if (!files.length) return;
    setState({ phase: "uploading", progress: 0, message: "מכינים את ההעלאה…" });

    try {
      const optimizedFiles = await Promise.all(files.map(({ file }) => optimizeImage(file)));
      const response = await fetch("/api/uploads/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: optimizedFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          tableNumber,
          message,
        }),
      });
      const payload = await response.json() as {
        message?: string;
        uploads?: Array<{ id: string; signedUrl: string; completionToken: string; backend?: "supabase" | "fallback" }>;
      };
      if (!response.ok || !payload.uploads || payload.uploads.length !== files.length) {
        throw new Error(payload.message ?? "Upload preparation failed");
      }

      for (let index = 0; index < files.length; index += 1) {
        const selected = optimizedFiles[index]!;
        const uploadInfo = payload.uploads[index]!;
        const backend = uploadInfo.backend ?? "supabase";
        await uploadWithProgress(uploadInfo.signedUrl, selected, (value) => {
          const total = ((index + value) / files.length) * 100;
          setState({ phase: "uploading", progress: total, message: `מעלים ${index + 1} מתוך ${files.length}…` });
        }, backend);
        const completionResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: uploadInfo.id, completionToken: uploadInfo.completionToken, backend }),
        });
        if (!completionResponse.ok) throw new Error("Upload completion failed");
      }

      files.forEach((item) => revokePreview(item.preview));
      setFiles([]);
      setMessage("");
      if (inputRef.current) inputRef.current.value = "";
      setState({
        phase: "success",
        progress: 100,
        message: "קיבלנו! התמונות בדרך אלינו ויופיעו על המסך במהלך הערב ❤️",
      });
    } catch (error) {
      console.error(error);
      setState({ phase: "error", progress: 0, message: "לא הצלחנו להשלים את ההעלאה. בדקו את החיבור ונסו שוב ❤️" });
    }
  }

  return (
    <section className="rounded-[2rem] border border-stone-900/10 bg-white/72 p-5 shadow-[0_20px_70px_rgba(40,33,24,.07)] sm:p-8" aria-labelledby="upload-title">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#eee4d2] text-[#8d6a38]"><Camera aria-hidden="true" /></span>
        <div>
          <h2 id="upload-title" className="text-xl font-semibold">מהטלפון שלכם ישר אלינו</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">תמונות, סלפי מהרחבה או סרטון קצר — אפשר לבחור כמה יחד.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        id="wedding-media"
        type="file"
        disabled={!enabled}
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        className="sr-only"
        onChange={(event) => selectFiles(event.target.files)}
      />
      <label htmlFor="wedding-media" className={`mt-6 flex min-h-36 flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-5 text-center transition focus-within:ring-2 focus-within:ring-[#a9854f] ${enabled ? "cursor-pointer border-[#a9854f]/55 bg-[#f7f2e8] hover:border-[#8e6935] hover:bg-[#f1e8d8]" : "cursor-not-allowed border-stone-300 bg-stone-100 text-stone-400"}`}>
        <ImagePlus className="mb-3 text-[#96713d]" aria-hidden="true" />
        <span className="font-semibold">בחירת תמונות או סרטונים</span>
        <span className="mt-1 text-xs text-stone-500">עד 10 קבצים · תמונה עד 25MB · סרטון קצר עד 50MB</span>
      </label>

      {files.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}`} className="group relative aspect-square overflow-hidden rounded-xl bg-stone-200">
              {item.file.type.startsWith("video/") ? (
                <video src={item.preview} className="size-full object-cover" aria-label={`תצוגה מקדימה: ${item.file.name}`} muted />
              ) : (
                // Blob previews cannot use Next Image and never leave the device before upload.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt={`תצוגה מקדימה: ${item.file.name}`} className="size-full object-cover" />
              )}
              <span className="absolute bottom-1 right-1 rounded-full bg-black/65 p-1 text-white">{item.file.type.startsWith("video/") ? <Film size={12} /> : <Camera size={12} />}</span>
              <button type="button" onClick={() => remove(index)} className="absolute left-1 top-1 grid size-7 place-items-center rounded-full bg-black/65 text-white" aria-label={`הסרת ${item.file.name}`}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="media-message" className="mb-2 block text-sm font-semibold">רוצים לצרף ברכה? <span className="font-normal text-stone-500">לא חובה</span></label>
        <Textarea id="media-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={600} rows={3} placeholder="כמה מילים שיופיעו לצד התמונה…" disabled={!enabled || state.phase === "uploading"} />
      </div>

      {state.phase === "uploading" && (
        <div className="mt-5" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-[#a9854f] transition-[width]" style={{ width: `${state.progress}%` }} /></div>
          <p className="mt-2 text-sm text-stone-600">{state.message}</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="button" size="lg" onClick={upload} disabled={!enabled || !files.length || state.phase === "uploading"}>
          העלאה אלינו
          <ImagePlus aria-hidden="true" size={18} />
        </Button>
        <p className={`flex items-center gap-2 text-sm ${state.phase === "error" ? "text-red-800" : "text-[#765b35]"}`} aria-live="polite">
          {state.phase === "success" && <CheckCircle2 aria-hidden="true" size={17} />}
          {enabled ? state.message : "העלאת התמונות והסרטונים תיפתח בקרוב ❤️"}
        </p>
      </div>
      <p className="mt-4 text-xs leading-5 text-stone-500">תמונות גדולות מוקטנות במכשיר לפני ההעלאה כדי שהשיתוף יהיה מהיר ונוח.</p>
    </section>
  );
}
