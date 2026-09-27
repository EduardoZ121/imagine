const MAX_PIXELS = 1920;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Só são aceites imagens (JPEG, PNG, WebP).");
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PIXELS / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return readFileAsDataUrl(file);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return readFileAsDataUrl(file);
  }
}

export async function constrainImageForEndpoint(source: string, maxPixels = 768): Promise<string> {
  try {
    const response = await fetch(displaySrc(source));
    if (!response.ok) return source;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(64, Math.round((bitmap.width * scale) / 64) * 64);
    const height = Math.max(64, Math.round((bitmap.height * scale) / 64) * 64);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return source;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return source;
  }
}

export async function videoFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Só são aceites vídeos MP4.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("O vídeo é demasiado grande (máx. 12 MB). Usa um clip mais curto.");
  }
  return readFileAsDataUrl(file);
}

export function mediaProxyUrl(url: string, filename: string, download = false): string {
  const params = new URLSearchParams({ url, filename });
  if (download) params.set("download", "1");
  return `/api/media?${params.toString()}`;
}

export function displaySrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return url;
  return mediaProxyUrl(url, "media");
}

export function downloadFromUrl(url: string, filename: string) {
  const href =
    url.startsWith("data:") || url.startsWith("blob:") ? url : mediaProxyUrl(url, filename, true);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function filenameFor(kind: "image" | "video", id: string): string {
  const short = id.slice(0, 8);
  return kind === "video" ? `imagine-${short}.mp4` : `imagine-${short}.jpg`;
}

export function aspectCss(ratio: string): string {
  if (!ratio || ratio === "auto") return "1 / 1";
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return "1 / 1";
  return `${w} / ${h}`;
}
