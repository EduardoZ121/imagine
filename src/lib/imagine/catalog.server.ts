import { replicateAuthorization } from "./xai.server";
import { GROK_CATALOG_MODEL, type CatalogModel, type CatalogType, type ModelField } from "./catalog";
import { hfFields, hfModel } from "./hf";
import { startHfModel } from "./hf.server";

const REPLICATE = "https://api.replicate.com/v1";
const CACHE_MS = 15 * 60 * 1000;
const MODEL_ID = /^[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9][a-z0-9._-]{0,80}$/i;

const FEATURED = ["flux", "ideogram", "recraft", "qwen image", "wan video", "ltx video", "seedance", "upscaler"];

type RawModel = {
  owner?: string;
  name?: string;
  description?: string;
  cover_image_url?: string | null;
  run_count?: number;
  url?: string;
  is_official?: boolean;
};

function authHeaders(): HeadersInit | undefined {
  const authorization = replicateAuthorization();
  if (!authorization) return undefined;
  return { Authorization: authorization };
}

function publicError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("credit") || status === 402) {
    return "Sem crédito na conta para esta geração.";
  }
  if (status === 404) return "Este modelo não está disponível.";
  if (lower.includes("sexual") || lower.includes("nsfw")) {
    return "Este modelo bloqueou o pedido por conteúdo sexual. Tenta o Grok Imagine ou um texto mais neutro.";
  }
  if (lower.includes("sensitive") || lower.includes("e005") || lower.includes("moderation")) {
    return "A moderação deste modelo bloqueou o pedido. Tenta o Grok Imagine ou muda o texto.";
  }
  if (status === 422 || lower.includes("invalid")) return explainValidation(raw);
  if (status === 429) return "Demasiados pedidos. Espera um momento.";
  return "A geração falhou. Tenta outro modelo ou outro prompt.";
}

function explainValidation(raw: string): string {
  try {
    const json = JSON.parse(raw) as {
      detail?: unknown;
      invalid_fields?: { description?: string; type?: string }[];
    };
    const bits = [
      ...(json.invalid_fields || []).map((field) => `${field.type || ""} ${field.description || ""}`),
      typeof json.detail === "string" ? json.detail : "",
    ]
      .join(" ")
      .toLowerCase();
    if (/img_|image|input_image|frame|cond_path/.test(bits) && /required|missing/.test(bits)) {
      return "Este modelo precisa de uma foto. Anexa uma imagem e tenta outra vez.";
    }
    if (/video/.test(bits) && /required|missing/.test(bits)) {
      return "Este modelo precisa de um vídeo.";
    }
    if (/required|missing/.test(bits)) return "Falta um dado obrigatório deste modelo.";
    if (/invalid type|expected: integer|expected: number/.test(bits)) {
      return "Um número deste modelo foi recusado. Muda a duração ou a resolução e tenta outra vez.";
    }
  } catch {
    /* ignore */
  }
  return "Este modelo recusou estes parâmetros. Muda a duração, a resolução ou o formato.";
}

function thumb(url?: string | null): string | undefined {
  if (!url || !url.startsWith("https://")) return undefined;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return undefined;
  return url;
}

function classify(tags: string[], name: string, description = ""): CatalogType {
  const blob = `${tags.join(" ")} ${name} ${description}`.toLowerCase();
  if (blob.includes("upscal") || blob.includes("esrgan") || blob.includes("gfpgan")) return "upscale";
  if (blob.includes("video") || blob.includes("seedance")) return "video";
  if (blob.includes("image") || blob.includes("flux") || blob.includes("text-to-image")) return "image";
  return "other";
}

function toCatalog(model: RawModel, tags: string[] = []): CatalogModel | undefined {
  const owner = model.owner?.trim();
  const name = model.name?.trim();
  if (!owner || !name) return undefined;
  const id = `${owner}/${name}`;
  if (!MODEL_ID.test(id) || owner.toLowerCase() === "xai") return undefined;
  const cleanTags = tags.filter((tag) => typeof tag === "string").slice(0, 8);
  return {
    id,
    provider: "replicate",
    owner,
    name,
    displayName: name.replace(/[-_]/g, " "),
    description: (model.description || "Modelo no Replicate.").replace(/\s+/g, " ").slice(0, 180),
    type: classify(cleanTags, name, model.description || ""),
    tags: cleanTags,
    thumbnail: thumb(model.cover_image_url),
    official: model.is_official === true ? true : model.is_official === false ? false : undefined,
    supportsLora: cleanTags.some((tag) => /lora/i.test(tag)),
    followsPrompt: !/esrgan|gfpgan|upscal|restore/i.test(`${name} ${cleanTags.join(" ")}`),
    url: model.url,
    runCount: typeof model.run_count === "number" ? model.run_count : undefined,
    pricingLabel: "Preço indisponível nesta API",
  };
}

async function searchRaw(query: string): Promise<CatalogModel[]> {
  const headers = authHeaders();
  if (!headers) return [];
  const res = await fetch(`${REPLICATE}/search?query=${encodeURIComponent(query)}`, { headers });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    models?: { model?: RawModel; metadata?: { tags?: string[] } }[];
  };
  const out: CatalogModel[] = [];
  for (const hit of json.models || []) {
    const item = toCatalog(hit.model || {}, hit.metadata?.tags || []);
    if (item) out.push(item);
  }
  return out;
}

let featuredCache: { at: number; models: CatalogModel[] } | null = null;

async function featured(): Promise<CatalogModel[]> {
  if (featuredCache && Date.now() - featuredCache.at < CACHE_MS) return featuredCache.models;
  const batches = await Promise.all(FEATURED.map((query) => searchRaw(query).catch(() => [])));
  const map = new Map<string, CatalogModel>();
  for (const batch of batches) {
    for (const model of batch) {
      if (!map.has(model.id)) map.set(model.id, model);
    }
  }
  const models = [...map.values()].sort((a, b) => (b.runCount || 0) - (a.runCount || 0)).slice(0, 48);
  featuredCache = { at: Date.now(), models };
  return models;
}

export async function searchCatalog(query?: string): Promise<CatalogModel[]> {
  const q = query?.trim() || "";
  const grokHit = !q || /grok|imagine|xai|imagem|vídeo|video/i.test(q);
  if (!q) {
    const models = await featured();
    return grokHit ? [GROK_CATALOG_MODEL, ...models] : models;
  }
  const found = (await searchRaw(q)).sort((a, b) => (b.runCount || 0) - (a.runCount || 0)).slice(0, 24);
  return grokHit ? [GROK_CATALOG_MODEL, ...found.filter((m) => m.id !== GROK_CATALOG_MODEL.id)] : found;
}

type SchemaProp = {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  allOf?: { $ref?: string }[];
  items?: { type?: string; format?: string };
};

function resolveSpec(
  spec: SchemaProp,
  schemas: Record<string, SchemaProp | undefined>,
): SchemaProp {
  const ref = spec.allOf?.find((item) => item.$ref)?.$ref;
  if (!ref?.startsWith("#/components/schemas/")) return spec;
  const name = ref.split("/").pop() || "";
  const target = schemas[name];
  if (!target) return spec;
  return { ...target, description: spec.description || target.description, default: spec.default ?? target.default, title: spec.title || target.title };
}

function fieldKind(key: string, spec: SchemaProp): ModelField["kind"] | undefined {
  const keyName = key.toLowerCase();
  if (spec.format === "uri" && /^(video|input_video|video_url)$/.test(keyName)) return "video";
  if (spec.type === "array" && /image|img/.test(keyName) && !/mask/.test(keyName)) return "image";
  if (
    /^(image|input_image|img_cond_path|start_image|first_frame|last_frame|last_frame_image|init_image)$/.test(
      keyName,
    )
  ) {
    return "image";
  }
  if (spec.format === "uri" && /image|img|frame/.test(keyName) && !/video/.test(keyName)) return "image";
  if (Array.isArray(spec.enum) && spec.enum.length) return "enum";
  if (spec.type === "integer") return "integer";
  if (spec.type === "number") return "number";
  if (spec.type === "boolean") return "boolean";
  if (spec.type === "string" || spec.enum) return "string";
  return undefined;
}

export async function describeModel(modelId: string): Promise<
  | { ok: true; model: CatalogModel; fields: ModelField[]; versionId?: string }
  | { ok: false; error: string }
> {
  const hosted = hfModel(modelId);
  if (hosted) return { ok: true, model: hosted, fields: hfFields(hosted) };
  if (!MODEL_ID.test(modelId) || modelId.toLowerCase().startsWith("xai/")) {
    return { ok: false, error: "Modelo inválido." };
  }
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "A geração não está disponível neste momento." };
  const res = await fetch(`${REPLICATE}/models/${modelId}`, { headers });
  if (!res.ok) return { ok: false, error: publicError(res.status, await res.text()) };
  const json = (await res.json()) as RawModel & {
    latest_version?: {
      openapi_schema?: {
        components?: {
          schemas?: Record<string, SchemaProp & { properties?: Record<string, SchemaProp>; required?: string[] }>;
        };
      };
    };
  };
  const model = toCatalog(json, []);
  if (!model) return { ok: false, error: "Modelo inválido." };
  if (json.is_official === true) model.official = true;
  if (json.is_official === false) model.official = false;
  const schemas = json.latest_version?.openapi_schema?.components?.schemas || {};
  const input = schemas.Input;
  const props = input?.properties || {};
  const required = new Set(input?.required || []);
  const fields: ModelField[] = [];
  for (const [key, raw] of Object.entries(props)) {
    if (key === "prompt" || key === "disable_safety_checker") continue;
    const spec = resolveSpec(raw, schemas);
    const kind = fieldKind(key, spec);
    if (!kind) continue;
    const enums = Array.isArray(spec.enum) ? spec.enum.map(String).slice(0, 16) : undefined;
    const fallback = spec.default;
    fields.push({
      key,
      label: spec.title || key.replace(/_/g, " "),
      kind: enums?.length ? "enum" : kind,
      required: required.has(key),
      description: spec.description?.slice(0, 140),
      enumValues: enums,
      minimum: typeof spec.minimum === "number" ? spec.minimum : undefined,
      maximum: typeof spec.maximum === "number" ? spec.maximum : undefined,
      defaultValue:
        typeof fallback === "string" || typeof fallback === "number" || typeof fallback === "boolean"
          ? fallback
          : undefined,
      multiple: spec.type === "array",
      numeric: Array.isArray(spec.enum) && spec.enum.length > 0 && spec.enum.every((item) => typeof item === "number"),
      prominent: /^(duration|aspect_ratio|resolution|quality|output_quality|megapixels|generate_audio|output_format)$/.test(
        key,
      ),
      lora: /lora/i.test(key),
    });
  }
  fields.sort((a, b) => Number(b.required) - Number(a.required));
  if (fields.some((field) => field.lora)) model.supportsLora = true;
  model.followsPrompt = Object.keys(props).some((key) => /^(prompt|text|caption)$/.test(key));
  if (model.type === "upscale" || /esrgan|gfpgan|upscal/i.test(model.name)) {
    model.type = "upscale";
    model.followsPrompt = false;
  }
  const versionId = (json as { latest_version?: { id?: string } }).latest_version?.id;
  return { ok: true, model, fields: fields.slice(0, 14), versionId };
}

function allowedMedia(value: string): boolean {
  if (value.startsWith("data:image/") || value.startsWith("data:video/")) return value.length < 8_000_000;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function coerceNumericFields(payload: Record<string, unknown>, raw: string): boolean {
  let changed = false;
  try {
    const json = JSON.parse(raw) as { invalid_fields?: { field?: string; description?: string }[] };
    for (const field of json.invalid_fields || []) {
      const key = String(field.field || "").replace(/^input\./, "");
      const description = String(field.description || "").toLowerCase();
      const current = payload[key];
      if (!key || typeof current !== "string") continue;
      if (!/integer|number/.test(description)) continue;
      const n = Number(current);
      if (!Number.isFinite(n)) continue;
      payload[key] = Number.isInteger(n) ? Math.round(n) : n;
      changed = true;
    }
  } catch {
    /* ignore */
  }
  return changed;
}

export async function startCatalogModel(input: {
  modelId: string;
  prompt: string;
  values: Record<string, string | number | boolean>;
  imageUrl?: string;
  lastFrameUrl?: string;
  videoUrl?: string;
}): Promise<{ ok: true; requestId: string; kind: "image" | "video" } | { ok: false; error: string }> {
  if (hfModel(input.modelId)) return startHfModel(input);
  const described = await describeModel(input.modelId);
  if (!described.ok) return described;
  const prompt = input.prompt.trim().slice(0, 4000);
  const upscale = described.model.followsPrompt === false;
  if (!prompt && !(upscale && input.imageUrl)) return { ok: false, error: "Escreve um prompt." };
  if (upscale && prompt && !/nitidez|upscale|resolu|qualidade|aumentar/i.test(prompt)) {
    return {
      ok: false,
      error: "Este modelo só aumenta a nitidez. Não lê o texto e não muda a roupa. Crédito não foi gasto.",
    };
  }
  if (input.imageUrl) {
    if (input.imageUrl.startsWith("data:") && input.imageUrl.length >= 8_000_000) {
      return { ok: false, error: "A foto é grande demais. Escolhe uma mais leve. Crédito não foi gasto." };
    }
    if (!allowedMedia(input.imageUrl)) {
      return { ok: false, error: "O envio da foto falhou. Anexa a imagem outra vez. Crédito não foi gasto." };
    }
  }
  const payload: Record<string, unknown> = upscale || !prompt ? {} : { prompt };
  const imageFields = described.fields.filter((field) => field.kind === "image" && !/mask/.test(field.key));
  if (input.imageUrl && imageFields.length === 0 && described.model.followsPrompt !== false) {
    return {
      ok: false,
      error: "Este modelo ignora a foto. Para mudar a imagem, escolhe Flux Kontext. Crédito não foi gasto.",
    };
  }
  const imageField = imageFields.find((field) => field.required) || imageFields[0];
  const videoField = described.fields.find((field) => field.kind === "video" && field.required);
  if (imageField?.required && !input.imageUrl) {
    return { ok: false, error: "Este modelo precisa de uma foto. Anexa uma imagem." };
  }
  if (videoField && !input.videoUrl) {
    return { ok: false, error: "Este modelo precisa de um vídeo." };
  }
  if (input.imageUrl) {
    const primary =
      imageFields.find((field) =>
        /^(image|input_image|img_cond_path|start_image|first_frame|init_image)$/.test(field.key),
      ) || imageFields.find((field) => !/last|reference|ref_/.test(field.key)) ||
      imageFields[0];
    if (!primary) {
      return {
        ok: false,
        error: "Este modelo não recebeu a foto. Não há campo de imagem. Crédito não foi gasto.",
      };
    }
    payload[primary.key] = primary.multiple ? [input.imageUrl] : input.imageUrl;
    const lastField = imageFields.find((field) => /last/.test(field.key) && field.key !== primary.key);
    if (lastField && input.lastFrameUrl && allowedMedia(input.lastFrameUrl)) {
      payload[lastField.key] = input.lastFrameUrl;
    }
  }
  if (videoField && input.videoUrl && allowedMedia(input.videoUrl)) payload[videoField.key] = input.videoUrl;
  for (const field of described.fields) {
    if (field.kind === "image" || field.kind === "video") continue;
    const raw = input.values[field.key];
    if (raw === undefined || raw === "") continue;
    if (field.kind === "integer" || field.kind === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) continue;
      payload[field.key] = field.kind === "integer" ? Math.round(n) : n;
    } else if (field.kind === "boolean") {
      payload[field.key] = raw === true || raw === "true";
    } else if (field.kind === "enum") {
      const value = String(raw);
      if (!field.enumValues?.includes(value)) continue;
      if (value === "match_input_image" && !input.imageUrl) {
        const fallback = field.enumValues.find((item) => item !== "match_input_image");
        if (fallback) payload[field.key] = fallback;
        continue;
      }
      payload[field.key] = field.numeric ? Number(value) : value;
    } else if (typeof raw === "string") {
      payload[field.key] = raw.slice(0, 2000);
    }
  }
  console.info(
    JSON.stringify({
      model: input.modelId,
      promptChars: prompt.length,
      keys: Object.keys(payload),
      hasImage: imageFields.some((field) => payload[field.key] != null),
    }),
  );
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "A geração não está disponível neste momento." };
  const post = async (path: string, body: unknown) =>
    fetch(`${REPLICATE}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let res = await post(`/models/${input.modelId}/predictions`, { input: payload });
  if (res.status === 404 && described.versionId) {
    res = await post("/predictions", { version: described.versionId, input: payload });
  }
  if (res.status === 422) {
    const raw = await res.text();
    if (coerceNumericFields(payload, raw)) {
      res = await post(`/models/${input.modelId}/predictions`, { input: payload });
      if (res.status === 404 && described.versionId) {
        res = await post("/predictions", { version: described.versionId, input: payload });
      }
      if (!res.ok) return { ok: false, error: publicError(res.status, await res.text()) };
    } else {
      return { ok: false, error: publicError(422, raw) };
    }
  } else if (!res.ok) {
    return { ok: false, error: publicError(res.status, await res.text()) };
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) return { ok: false, error: "A API não devolveu um pedido." };
  return {
    ok: true,
    requestId: json.id,
    kind: described.model.type === "video" ? "video" : "image",
  };
}
