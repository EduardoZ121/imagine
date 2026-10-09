import { readFileSync } from "node:fs";
import { hfModel, hfSize, isHfModel, maxSteps, type HfModel } from "./hf";
import { MAX_PROMPT } from "./constants";

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

function textOf(values: Record<string, string | number | boolean>, key: string, fallback: string): string {
  const value = values[key];
  return typeof value === "string" && value ? value : fallback;
}

function stepsFor(model: HfModel, raw: string): number {
  const asked = Number(raw);
  const max = maxSteps(model);
  const n = Number.isFinite(asked) ? asked : max;
  return Math.min(max, Math.max(4, Math.round(n)));
}

function on(values: Record<string, string | number | boolean>, key: string): boolean {
  if (values[key] === false) return false;
  if (key !== "keep_face" && values.keep_subject === false && values[key] === undefined) return false;
  return true;
}

function editPrompt(prompt: string, values: Record<string, string | number | boolean>): string {
  const locks = [
    on(values, "keep_face") ? "the same face" : "",
    on(values, "keep_body") ? "the same body and pose" : "",
    on(values, "keep_clothes") ? "the same clothes" : "",
  ].filter(Boolean);
  if (!locks.length) return prompt;
  return `${prompt}. Keep ${locks.join(", ")}.`;
}

function guidanceFor(model: HfModel, fidelity: string): number {
  if (model.providerId.includes("kontext")) return fidelity === "Baixa" ? 2 : fidelity === "Alta" ? 3.5 : 2.5;
  if (model.task === "image-to-image") return fidelity === "Baixa" ? 3.5 : fidelity === "Alta" ? 5 : 4.5;
  return fidelity === "Baixa" ? 2 : fidelity === "Alta" ? 4 : 3;
}

function accelerationFor(steps: number): "none" | "regular" | "high" {
  if (steps <= 8) return "regular";
  if (steps >= 28) return "none";
  return "regular";
}

function payloadFor(model: HfModel, prompt: string, values: Record<string, string | number | boolean>, imageUrl?: string) {
  const aspect = aspectOf(values);
  const quality = textOf(values, "quality", "720p");
  const guidance = textOf(values, "guidance", "Média");
  const steps = stepsFor(model, textOf(values, "steps", ""));
  const size = aspect === "original" ? undefined : hfSize(aspect);
  const hd = quality !== "480p";
  if (model.task === "text-to-video") {
    return {
      prompt,
      aspect_ratio: aspect === "1:1" || aspect === "9:16" || aspect === "16:9" ? aspect : "16:9",
      resolution: hd ? "720p" : "480p",
      num_frames: 81,
    };
  }
  if (model.task === "image-to-video") {
    const instruction = editPrompt(prompt, values);
    if (model.providerId.includes("ltx")) {
      return {
        prompt: instruction,
        image_url: imageUrl,
        num_frames: hd ? 121 : 73,
        video_size: "auto",
        image_strength: 1,
        enable_prompt_expansion: false,
        generate_audio: false,
        video_quality: hd ? "high" : "medium",
        acceleration: hd ? "none" : "regular",
      };
    }
    const ratio = aspect === "16:9" || aspect === "9:16" || aspect === "1:1" ? aspect : "auto";
    return {
      prompt: instruction,
      image_url: imageUrl,
      resolution: hd ? "720p" : "480p",
      aspect_ratio: ratio,
      num_frames: 81,
    };
  }
  if (model.task === "image-to-image") {
    const instruction = editPrompt(prompt, values);
    if (model.providerId.includes("kontext")) {
      return {
        prompt: instruction,
        image_url: imageUrl,
        num_inference_steps: steps,
        guidance_scale: guidanceFor(model, guidance),
        resolution_mode: aspect === "16:9" || aspect === "9:16" || aspect === "1:1" ? aspect : "match_input",
        output_format: "png",
      };
    }
    const body: Record<string, unknown> = {
      prompt: instruction,
      image_urls: imageUrl ? [imageUrl] : undefined,
      num_inference_steps: steps,
      output_format: "png",
    };
    if (!model.providerId.includes("klein")) body.image_url = imageUrl;
    if (size) body.image_size = size;
    if (model.providerId.includes("qwen-image")) {
      body.guidance_scale = guidanceFor(model, guidance);
      body.acceleration = accelerationFor(steps);
      if (on(values, "keep_face")) body.negative_prompt = "deformed face, extra limbs, blurry";
    }
    return body;
  }
  const body: Record<string, unknown> = {
    prompt,
    image_size: size ?? hfSize("1:1"),
    num_images: 1,
    num_inference_steps: steps,
    output_format: "png",
  };
  if (model.providerId.includes("qwen-image")) {
    body.guidance_scale = guidanceFor(model, guidance);
    body.acceleration = accelerationFor(steps);
  }
  return body;
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
  const prompt = input.prompt.trim().slice(0, MAX_PROMPT);
  if (!prompt) return { ok: false, error: "Escreve um prompt." };
  if (model.needsImage && !input.imageUrl) {
    return { ok: false, error: "Este modelo precisa de uma foto. Anexa uma imagem. Crédito não foi gasto." };
  }
  if (!model.needsImage && input.imageUrl) {
    return {
      ok: false,
      error: "Este modelo ignora a foto e inventa outra pessoa. Escolhe Qwen Image Edit, FLUX Kontext ou FLUX.2 Klein. Crédito não foi gasto.",
    };
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
      kind: model.task === "text-to-image" || model.task === "image-to-image" ? "image" : "video",
    }),
  ).toString("base64url");
  return {
    ok: true,
    requestId: `hf:${ticket}`,
    kind: model.task === "text-to-image" || model.task === "image-to-image" ? "image" : "video",
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
