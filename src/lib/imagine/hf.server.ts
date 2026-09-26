import { readFileSync } from "node:fs";
import { hfModel, hfSize, isHfModel, type HfModel } from "./hf";

const ROUTER = "https://router.huggingface.co/fal-ai";

function hfToken(): string | undefined {
  const fromEnv = process.env.HF_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(".env", "utf8");
    const line = text.split("\n").find((item) => item.startsWith("HF_TOKEN="));
    const value = line?.slice("HF_TOKEN=".length).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function hfError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (status === 401 || status === 403) return "A chave da Hugging Face foi recusada.";
  if (status === 402 || lower.includes("credit") || lower.includes("exceeded")) {
    return "Sem crédito na Hugging Face para esta geração.";
  }
  if (lower.includes("sexual") || lower.includes("nsfw") || lower.includes("safety") || lower.includes("moderation")) {
    return "A moderação deste modelo bloqueou o pedido. Muda o texto.";
  }
  if (status === 429) return "Demasiados pedidos na Hugging Face. Espera um momento.";
  return "A Hugging Face recusou este pedido. Tenta outro modelo ou outro texto.";
}

function aspectOf(values: Record<string, string | number | boolean>): string {
  const value = values.aspect_ratio;
  return typeof value === "string" ? value : "1:1";
}

function payloadFor(model: HfModel, prompt: string, values: Record<string, string | number | boolean>, imageUrl?: string) {
  const aspect = aspectOf(values);
  if (model.task === "text-to-video") {
    return { prompt, aspect_ratio: aspect === "1:1" ? "1:1" : aspect };
  }
  if (model.task === "image-to-image") {
    return {
      prompt,
      image_url: imageUrl,
      image_urls: imageUrl ? [imageUrl] : undefined,
      image_size: hfSize(aspect),
    };
  }
  return { prompt, image_size: hfSize(aspect), num_images: 1 };
}

export async function startHfModel(input: {
  modelId: string;
  prompt: string;
  values: Record<string, string | number | boolean>;
  imageUrl?: string;
}): Promise<{ ok: true; requestId: string; kind: "image" | "video" } | { ok: false; error: string }> {
  const model = hfModel(input.modelId);
  if (!model) return { ok: false, error: "Este modelo da Hugging Face não está nesta lista." };
  const token = hfToken();
  if (!token) return { ok: false, error: "A Hugging Face não está configurada neste servidor." };
  const prompt = input.prompt.trim().slice(0, 2000);
  if (!prompt) return { ok: false, error: "Escreve um prompt." };
  if (model.needsImage && !input.imageUrl) {
    return { ok: false, error: "Este modelo precisa de uma foto. Anexa uma imagem. Crédito não foi gasto." };
  }
  const url = `${ROUTER}/${model.providerId}?_subdomain=queue`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payloadFor(model, prompt, input.values, input.imageUrl)),
    });
  } catch {
    return { ok: false, error: "Não consegui contactar a Hugging Face." };
  }
  const raw = await response.text();
  if (!response.ok) return { ok: false, error: hfError(response.status, raw) };
  let json: { request_id?: string; status?: string; response_url?: string };
  try {
    json = JSON.parse(raw) as { request_id?: string; status?: string; response_url?: string };
  } catch {
    return { ok: false, error: "A Hugging Face devolveu uma resposta inválida." };
  }
  if (!json.request_id || !json.response_url) return { ok: false, error: "A Hugging Face não abriu o pedido." };
  let path = "";
  try {
    path = new URL(json.response_url).pathname.replace(/^\//, "");
  } catch {
    return { ok: false, error: "A Hugging Face não abriu o pedido." };
  }
  if (!/^fal-ai\/[A-Za-z0-9./_-]{8,180}$/.test(path)) {
    return { ok: false, error: "A Hugging Face não abriu o pedido." };
  }
  const ticket = Buffer.from(
    JSON.stringify({
      path,
      kind: model.task === "text-to-video" ? "video" : "image",
    }),
  ).toString("base64url");
  return {
    ok: true,
    requestId: `hf:${ticket}`,
    kind: model.task === "text-to-video" ? "video" : "image",
  };
}

type HfTicket = { path: string; kind: "image" | "video" };

function readTicket(requestId: string): HfTicket | undefined {
  if (!requestId.startsWith("hf:")) return undefined;
  try {
    const json = JSON.parse(Buffer.from(requestId.slice(3), "base64url").toString("utf8")) as HfTicket;
    if (!json.path || (json.kind !== "image" && json.kind !== "video")) return undefined;
    if (!/^fal-ai\/[A-Za-z0-9./_-]{8,180}$/.test(json.path)) return undefined;
    return json;
  } catch {
    return undefined;
  }
}

function mediaUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.url === "string" && record.url.startsWith("https://")) return record.url;
  for (const key of ["images", "image", "video", "videos", "output"]) {
    const item = record[key];
    if (Array.isArray(item)) {
      for (const entry of item) {
        const found = mediaUrl(entry);
        if (found) return found;
      }
    } else {
      const found = mediaUrl(item);
      if (found) return found;
    }
  }
  return undefined;
}

export async function pollHfRequest(requestId: string): Promise<
  | { ok: true; status: "pending"; progress: number }
  | { ok: true; status: "done"; progress: 100; url: string }
  | { ok: true; status: "failed"; progress: 100; error: string }
  | { ok: false; error: string }
> {
  const ticket = readTicket(requestId);
  if (!ticket) return { ok: false, error: "Pedido inválido." };
  const token = hfToken();
  if (!token) return { ok: false, error: "A Hugging Face não está configurada neste servidor." };
  const statusUrl = `${ROUTER}/${ticket.path}/status?_subdomain=queue`;
  let response: Response;
  try {
    response = await fetch(statusUrl, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: true, status: "pending", progress: 20 };
  }
  const raw = await response.text();
  if (!response.ok) return { ok: false, error: hfError(response.status, raw) };
  let status = "";
  try {
    status = String((JSON.parse(raw) as { status?: string }).status || "");
  } catch {
    return { ok: true, status: "pending", progress: 20 };
  }
  if (status === "FAILED" || status === "ERROR") {
    return { ok: true, status: "failed", progress: 100, error: "A geração na Hugging Face falhou." };
  }
  if (status !== "COMPLETED") {
    return { ok: true, status: "pending", progress: status === "IN_PROGRESS" ? 60 : 18 };
  }
  const resultUrl = `${ROUTER}/${ticket.path}?_subdomain=queue`;
  const result = await fetch(resultUrl, { headers: { Authorization: `Bearer ${token}` } });
  const body = await result.text();
  if (!result.ok) return { ok: false, error: hfError(result.status, body) };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: true, status: "failed", progress: 100, error: "A Hugging Face não devolveu o ficheiro." };
  }
  const url = mediaUrl(json);
  if (!url) return { ok: true, status: "failed", progress: 100, error: "A Hugging Face não devolveu o ficheiro." };
  return { ok: true, status: "done", progress: 100, url };
}

export function hfRequest(requestId: string): boolean {
  return isHfModel("hf:") && requestId.startsWith("hf:");
}
