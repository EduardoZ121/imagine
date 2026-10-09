import {
  MAX_DATA_URL_CHARS,
  MAX_IMAGE_N,
  MAX_PROMPT,
} from "./constants";
import type {
  EnhanceInput,
  EnhanceResult,
  GenerateImageInput,
  GenerateImageResult,
  PollVideoResult,
  StartVideoInput,
  StartVideoResult,
} from "./types";

const XAI = "https://api.x.ai";
const REPLICATE = "https://api.replicate.com/v1";

const IMAGE_MODEL = "xai/grok-imagine-image-2";
const VIDEO_I2V_MODEL = "xai/grok-imagine-video-1.5";
const VIDEO_T2V_MODEL = "xai/grok-imagine-video";
const VIDEO_R2V_MODEL = "xai/grok-imagine-r2v";
const VIDEO_EXTEND_MODEL = "xai/grok-imagine-video-extension";

function xaiKey(): string | undefined {
  return process.env.XAI_API_KEY?.trim() || undefined;
}

function replicateToken(): string | undefined {
  return process.env.REPLICATE_API_TOKEN?.trim() || undefined;
}

export function replicateAuthorization(): string | undefined {
  const value = replicateToken();
  return value ? `Bearer ${value}` : undefined;
}

function clipPrompt(prompt: string): string {
  return prompt.trim().slice(0, MAX_PROMPT);
}

function isAllowedMediaUrl(url: string): boolean {
  if (url.startsWith("data:image/") || url.startsWith("data:video/")) {
    return url.length <= MAX_DATA_URL_CHARS;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    return (
      host === "imgen.x.ai" ||
      host === "vidgen.x.ai" ||
      host === "data.x.ai" ||
      host.endsWith(".x.ai") ||
      host === "replicate.delivery" ||
      host.endsWith(".replicate.delivery")
    );
  } catch {
    return false;
  }
}

const IMAGE_ASPECTS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "2:1",
  "1:2",
  "19.5:9",
  "9:19.5",
  "20:9",
  "9:20",
  "auto",
]);

const VIDEO_ASPECTS = new Set([
  "auto",
  "16:9",
  "4:3",
  "1:1",
  "9:16",
  "3:4",
  "3:2",
  "2:3",
]);

function mapImageAspect(aspect: string): string {
  if (aspect === "21:9" || aspect === "5:2") return "2:1";
  return IMAGE_ASPECTS.has(aspect) ? aspect : "1:1";
}

function mapVideoAspect(aspect: string): string {
  return VIDEO_ASPECTS.has(aspect) ? aspect : "16:9";
}

function mapVideoResolution(resolution: string): "480p" | "720p" {
  return resolution === "480p" ? "480p" : "720p";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstUrl(output: unknown): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (/^https?:\/\//.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
    return undefined;
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const found = firstUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    return firstUrl(record.url) || firstUrl(record.href);
  }
  return undefined;
}

function friendlyError(_status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("sexual") || lower.includes("nsfw")) {
    return "Este modelo bloqueou o pedido por conteúdo sexual. Tenta o Grok Imagine ou um texto mais neutro.";
  }
  if (lower.includes("copyright") || lower.includes("ipinfringement") || lower.includes("ip infringement")) {
    return "Este modelo bloqueou uma personagem ou marca. Descreve sem o nome.";
  }
  if (lower.includes("cannot be used together") || lower.includes("e006")) {
    return "Este modelo não aceita o primeiro frame junto com outras imagens. Deixa só a foto de início.";
  }
  if (
    lower.includes("sensitive") ||
    lower.includes("moderation") ||
    lower.includes("safety") ||
    lower.includes("flagged") ||
    lower.includes("e005") ||
    lower.includes("inappropriate")
  ) {
    return "A moderação deste modelo bloqueou o pedido. Tenta o Grok Imagine ou muda o texto.";
  }
  if (
    lower.includes("credit") ||
    lower.includes("billing") ||
    lower.includes("payment") ||
    lower.includes("spending-limit") ||
    lower.includes("402")
  ) {
    return "Sem créditos para gerar. Adiciona créditos e tenta de novo.";
  }
  if (
    lower.includes("token") ||
    lower.includes("api key") ||
    lower.includes("unauthor") ||
    lower.includes("forbidden") ||
    _status === 401 ||
    _status === 403
  ) {
    return "A geração não está autorizada neste momento.";
  }
  if (lower.includes("too long") || lower.includes("8.7")) {
    return "Esse vídeo é demasiado longo para editar. Usa um clip mais curto.";
  }
  if (_status === 429 || lower.includes("rate limit") || lower.includes("throttl")) {
    return "Demasiados pedidos. Espera um momento e tenta de novo.";
  }
  if (
    lower.includes("invalid") ||
    lower.includes("unprocessable") ||
    _status === 422 ||
    _status === 400
  ) {
    return "Não consegui usar este pedido. Tenta outro prompt ou outra foto.";
  }
  return "A geração falhou. Tenta de novo.";
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      detail?: unknown;
      error?: { message?: string } | string;
      title?: string;
      message?: string;
    };
    if (typeof json.detail === "string" && json.detail.trim()) {
      return friendlyError(res.status, json.detail);
    }
    if (Array.isArray(json.detail)) {
      const first = json.detail[0] as { msg?: string } | string | undefined;
      const msg = typeof first === "string" ? first : first?.msg;
      if (msg) return friendlyError(res.status, msg);
    }
    if (typeof json.error === "string" && json.error.trim()) {
      return friendlyError(res.status, json.error);
    }
    if (json.error && typeof json.error === "object" && json.error.message) {
      return friendlyError(res.status, json.error.message);
    }
    if (typeof json.message === "string" && json.message.trim()) {
      return friendlyError(res.status, json.message);
    }
    if (typeof json.title === "string" && json.title.trim()) {
      return friendlyError(res.status, json.title);
    }
  } catch {
    /* ignore */
  }
  return friendlyError(res.status, text.slice(0, 280));
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: string | null;
  output?: unknown;
  logs?: string | null;
  metrics?: { predict_time?: number };
};

async function replicateFetch(
  path: string,
  init?: RequestInit & { wait?: number },
): Promise<Response> {
  const token = replicateToken();
  if (!token) throw new Error("UNAVAILABLE");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (init?.wait) headers.Prefer = `wait=${init.wait}`;
  return fetch(`${REPLICATE}${path}`, {
    method: init?.method,
    headers,
    body: init?.body,
    signal: init?.signal,
  });
}

async function resolveMedia(url: string | undefined): Promise<string | undefined> {
  if (!url || !isAllowedMediaUrl(url)) return undefined;
  return url;
}

async function createPrediction(
  model: string,
  input: Record<string, unknown>,
  wait?: number,
): Promise<{ ok: true; prediction: ReplicatePrediction } | { ok: false; error: string }> {
  try {
    const res = await replicateFetch(`/models/${model}/predictions`, {
      method: "POST",
      body: JSON.stringify({ input }),
      wait,
    });
    if (!res.ok) return { ok: false, error: await readError(res) };
    const prediction = (await res.json()) as ReplicatePrediction;
    if (!prediction.id) return { ok: false, error: "A API não devolveu um pedido." };
    return { ok: true, prediction };
  } catch (err) {
    if (err instanceof Error && err.message === "UNAVAILABLE") {
      return { ok: false, error: "A geração não está disponível neste momento." };
    }
    return { ok: false, error: "Falha de rede ao contactar o modelo." };
  }
}

async function getPrediction(id: string): Promise<
  { ok: true; prediction: ReplicatePrediction } | { ok: false; error: string }
> {
  try {
    const res = await replicateFetch(`/predictions/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true, prediction: (await res.json()) as ReplicatePrediction };
  } catch {
    return { ok: false, error: "Falha ao consultar o pedido." };
  }
}

async function waitForPrediction(
  id: string,
  tries = 40,
): Promise<{ ok: true; prediction: ReplicatePrediction } | { ok: false; error: string }> {
  for (let i = 0; i < tries; i++) {
    const result = await getPrediction(id);
    if (!result.ok) return result;
    const status = result.prediction.status;
    if (status === "succeeded") return result;
    if (status === "failed" || status === "canceled") {
      return {
        ok: false,
        error: friendlyError(400, result.prediction.error || "A geração falhou."),
      };
    }
    await sleep(i < 3 ? 900 : 1600);
  }
  return { ok: false, error: "A geração demorou demasiado. Tenta de novo." };
}

async function runAndWait(
  model: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const started = await createPrediction(model, input, 55);
  if (!started.ok) return started;
  let prediction = started.prediction;
  if (prediction.status !== "succeeded") {
    const waited = await waitForPrediction(prediction.id!);
    if (!waited.ok) return waited;
    prediction = waited.prediction;
  }
  const url = firstUrl(prediction.output);
  if (!url) return { ok: false, error: "A geração não devolveu ficheiro. Tenta de novo." };
  return { ok: true, url };
}

export function isImagineAvailable(): boolean {
  return Boolean(replicateToken());
}

async function xaiFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = xaiKey();
  if (!key) throw new Error("UNAVAILABLE");
  return fetch(`${XAI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export async function enhancePrompt(input: EnhanceInput): Promise<EnhanceResult> {
  const original = clipPrompt(input.prompt);
  if (!original) return { ok: false, error: "Escreve um prompt." };
  if (!xaiKey()) return { ok: true, prompt: original };

  const modality =
    input.kind === "video"
      ? input.action === "extend"
        ? "video extension (describe only what happens NEXT, continuing from the last frame)"
        : input.action === "edit"
          ? "video edit (describe only the change to apply to the existing clip)"
          : "text-to-video / image-to-video shot"
      : input.action === "edit" || input.hasReferences
        ? "image edit / reference-to-image (describe the edit; refer to inputs as <IMAGE_0>, <IMAGE_1> when multiple)"
        : "text-to-image";

  const system = `You are a world-class prompt engineer for Grok Imagine (xAI).
Rewrite the user's request into ONE generation prompt that the Imagine model will follow faithfully.

Hard rules:
- Understand Portuguese, English, Spanish, or mixed language perfectly. Never drop a concrete detail, name, garment, body description, camera move, or setting.
- Preserve subject, action, clothing, body, identity, setting, style, camera, and mood EXACTLY. Do not invent a different scene. Do not "sanitize" or swap the subject.
- Write the output prompt in clear cinematic English (models follow English best) while keeping every named object, person trait, and action.
- If the user is brief, expand ONLY with useful visual specificity: lighting, materials, lens, atmosphere, texture, motion — still the same scene.
- For VIDEO shots: present tense, one continuous shot, include camera move AND subject motion.
- For IMAGE: composition, lighting, materials, lens. No motion language.
- Do not add on-screen text, watermarks, logos, or subtitles unless the user asked.
- Do not add sexual content the user did not ask for.
- If the user wrote a long script, keep every beat, name, and camera move. Do not compress a detailed prompt into one sentence.
- Do not refuse. Do not explain. Do not lecture. Output ONLY the rewritten prompt, no quotes.`;

  const user = [
    `Modality: ${modality}`,
    `Target format: ${input.formatLabel} (${input.aspectRatio})`,
    input.duration ? `Duration: ${input.duration}s` : null,
    input.hasStartFrame ? "A start frame image is attached — animate/edit from it." : null,
    input.hasReferences ? "Reference images are attached — keep likeness and garments." : null,
    "",
    "User prompt (follow this intent exactly):",
    original,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await xaiFetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 4096,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: true, prompt: original };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text || /i can't|i cannot|i won't|copyright|não posso|recuso/i.test(text)) {
      return { ok: true, prompt: original };
    }
    const cleaned = text.replace(/^["'\s]+|["'\s]+$/g, "").slice(0, MAX_PROMPT);
    return { ok: true, prompt: cleaned || original };
  } catch {
    return { ok: true, prompt: original };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  if (!replicateToken()) {
    return { ok: false, error: "A geração não está disponível neste momento." };
  }
  const prompt = clipPrompt(input.prompt);
  if (!prompt) return { ok: false, error: "Escreve um prompt." };

  const refs = (
    await Promise.all(input.references.slice(0, 5).map((url) => resolveMedia(url)))
  ).filter((url): url is string => Boolean(url));
  const n = Math.min(MAX_IMAGE_N, Math.max(1, Math.round(input.n) || 1));
  const payload: Record<string, unknown> = {
    prompt,
    resolution: input.resolution === "1k" ? "1k" : "2k",
    quality: input.quality === "low" ? "low" : "medium",
    aspect_ratio: mapImageAspect(input.aspectRatio),
  };
  if (refs[0]) payload.image = refs[0];

  const started = await Promise.all(
    Array.from({ length: n }, () => createPrediction(IMAGE_MODEL, payload)),
  );
  const requestIds = started
    .filter((item) => item.ok)
    .map((item) => `img:${item.prediction.id}`);
  if (!requestIds.length) {
    const first = started.find((item) => !item.ok);
    return {
      ok: false,
      error: first && !first.ok ? first.error : "A geração não devolveu imagens.",
    };
  }
  return { ok: true, requestIds };
}

export async function startVideo(input: StartVideoInput): Promise<StartVideoResult> {
  if (!replicateToken()) {
    return { ok: false, error: "A geração não está disponível neste momento." };
  }
  const prompt = clipPrompt(input.prompt);
  if (!prompt) return { ok: false, error: "Escreve um prompt." };

  const startFrame = await resolveMedia(input.startFrame);
  const lastFrame = await resolveMedia(input.lastFrame);
  const sourceVideo = await resolveMedia(input.sourceVideo);
  const references = (
    await Promise.all(input.references.slice(0, 7).map((url) => resolveMedia(url)))
  ).filter((url): url is string => Boolean(url));
  const aspect = mapVideoAspect(input.aspectRatio);
  const resolution = mapVideoResolution(input.resolution);

  if (input.action === "extend") {
    if (!sourceVideo) return { ok: false, error: "Escolhe um vídeo para estender." };
    const started = await createPrediction(VIDEO_EXTEND_MODEL, {
      prompt,
      video: sourceVideo,
      duration: Math.min(10, Math.max(2, Math.round(input.duration) || 6)),
    });
    if (!started.ok) return started;
    return { ok: true, requestId: started.prediction.id! };
  }

  if (input.action === "edit") {
    if (!sourceVideo) return { ok: false, error: "Escolhe um vídeo para editar." };
    const started = await createPrediction(VIDEO_T2V_MODEL, {
      prompt,
      video: sourceVideo,
    });
    if (!started.ok) return started;
    return { ok: true, requestId: started.prediction.id! };
  }

  if (input.startFrame && !startFrame) {
    return { ok: false, error: "Não consegui usar a foto. Anexa-a outra vez." };
  }

  if (startFrame) {
    const started = await createPrediction(VIDEO_I2V_MODEL, {
      prompt,
      image: startFrame,
      duration: Math.min(15, Math.max(1, Math.round(input.duration) || 6)),
      resolution,
      aspect_ratio: "auto",
    });
    if (!started.ok) return started;
    return { ok: true, requestId: started.prediction.id! };
  }

  if (references.length || lastFrame) {
    const refs = [...references];
    if (lastFrame) refs.push(lastFrame);
    const started = await createPrediction(VIDEO_R2V_MODEL, {
      prompt,
      reference_images: refs.slice(0, 7),
      duration: Math.min(10, Math.max(1, Math.round(input.duration) || 8)),
      resolution,
      aspect_ratio: aspect === "auto" ? "16:9" : aspect,
    });
    if (!started.ok) return started;
    return { ok: true, requestId: started.prediction.id! };
  }

  const frame = await createPrediction(IMAGE_MODEL, {
    prompt,
    resolution: "1k",
    quality: "medium",
    aspect_ratio: mapImageAspect(aspect === "auto" ? "16:9" : aspect),
  });
  if (!frame.ok) return frame;
  return { ok: true, requestId: `frame:${frame.prediction.id}` };
}

export async function cancelVideoRequest(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = requestId.trim();
  if (raw.startsWith("hf:")) return { ok: true };
  const id = raw.startsWith("frame:") ? raw.slice(6) : raw.startsWith("img:") ? raw.slice(4) : raw;
  if (!id || !/^[A-Za-z0-9._:-]+$/.test(id)) return { ok: false, error: "Pedido inválido." };
  if (!replicateToken()) return { ok: false, error: "A geração não está disponível neste momento." };
  try {
    const res = await replicateFetch(`/predictions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
    if (!res.ok && res.status !== 409) return { ok: false, error: await readError(res) };
    return { ok: true };
  } catch {
    return { ok: false, error: "Não consegui cancelar." };
  }
}

export async function pollVideoRequest(requestId: string): Promise<PollVideoResult> {
  if (requestId.trim().startsWith("hf:")) {
    const { pollHfRequest } = await import("./hf.server");
    return pollHfRequest(requestId.trim());
  }
  if (!replicateToken()) {
    return { ok: false, error: "A geração não está disponível neste momento." };
  }
  const raw = requestId.trim();
  const stage = raw.startsWith("frame:") ? "frame" : raw.startsWith("img:") ? "image" : undefined;
  const id = stage === "frame" ? raw.slice(6) : stage === "image" ? raw.slice(4) : raw;
  if (!id || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    return { ok: false, error: "Pedido inválido." };
  }

  const result = await getPrediction(id);
  if (!result.ok) return result;
  const prediction = result.prediction;
  const status = prediction.status;

  if (status === "failed" || status === "canceled") {
    return {
      ok: true,
      status: "failed",
      progress: 100,
      error: friendlyError(400, prediction.error || "A geração do vídeo falhou."),
    };
  }

  if (status === "succeeded") {
    const url = firstUrl(prediction.output);
    if (!url) {
      return {
        ok: true,
        status: "failed",
        progress: 100,
        error: "O vídeo não foi devolvido. Tenta de novo.",
      };
    }
    return {
      ok: true,
      status: "done",
      progress: 100,
      url,
      stage,
      runtimeSeconds: prediction.metrics?.predict_time,
    };
  }

  const progress = status === "processing" ? 55 : 12;
  return { ok: true, status: "pending", progress };
}
