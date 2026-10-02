import type { CatalogModel, ModelField } from "./catalog";

export type HfTask = "text-to-image" | "image-to-image" | "text-to-video" | "image-to-video";

export type HfModel = CatalogModel & {
  task: HfTask;
  providerId: string;
  needsImage: boolean;
  endpoint?: {
    env: string;
    fallbackUrl: string;
    handler?: "dreamshaper";
  };
};

export const HF_MODELS: HfModel[] = [
  {
    id: "hf:Lykon/dreamshaper-xl-v2-turbo",
    provider: "huggingface",
    owner: "Lykon",
    name: "dreamshaper-xl-v2-turbo",
    displayName: "DreamShaper XL Img2Img",
    description:
      "SDXL até 1024 px, sem filtro do fornecedor. Melhor detalhe e anatomia; descreve o resultado final.",
    type: "image",
    tags: ["image", "edit", "18+"],
    official: false,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Endpoint dedicado Hugging Face",
    task: "image-to-image",
    providerId: "Lykon/dreamshaper-xl-v2-turbo",
    needsImage: true,
    endpoint: {
      env: "HF_DREAMSHAPER_I2I_ENDPOINT_URL",
      fallbackUrl: "https://6ab9392b9ec415b652acd800.endpoints.huggingface.cloud",
      handler: "dreamshaper",
    },
  },
  {
    id: "hf:fancyfeast/big-asp-v2",
    provider: "huggingface",
    owner: "fancyfeast",
    name: "big-asp-v2",
    displayName: "BigASP v2",
    description:
      "Modelo SDXL da comunidade para adultos (18+). Texto para imagem; a primeira geração pode demorar enquanto a GPU inicia.",
    type: "image",
    tags: ["image", "sdxl", "18+"],
    official: false,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Endpoint dedicado Hugging Face",
    task: "text-to-image",
    providerId: "fancyfeast/big-asp-v2",
    needsImage: false,
    endpoint: {
      env: "HF_BIGASP_ENDPOINT_URL",
      fallbackUrl: "https://6ab925d18392dd29385ec956.endpoints.huggingface.cloud",
    },
  },
  {
    id: "hf:TheImposterImposters/LUSTIFY-v2.0",
    provider: "huggingface",
    owner: "TheImposterImposters",
    name: "LUSTIFY-v2.0",
    displayName: "Lustify SDXL v2",
    description:
      "Modelo SDXL da comunidade para adultos (18+). Texto para imagem com detalhe fotográfico.",
    type: "image",
    tags: ["image", "sdxl", "18+"],
    official: false,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Endpoint dedicado Hugging Face",
    task: "text-to-image",
    providerId: "TheImposterImposters/LUSTIFY-v2.0",
    needsImage: false,
    endpoint: {
      env: "HF_LUSTIFY_ENDPOINT_URL",
      fallbackUrl: "https://6ab925d18392dd29385ec955.endpoints.huggingface.cloud",
    },
  },
  {
    id: "hf:Qwen/Qwen-Image-Edit",
    provider: "huggingface",
    owner: "Qwen",
    name: "Qwen-Image-Edit",
    displayName: "Qwen Image Edit",
    description: "Muda a foto e tenta manter a mesma pessoa. Usa o formato Original.",
    type: "image",
    tags: ["image", "edit"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-image",
    providerId: "fal-ai/qwen-image-edit-plus",
    needsImage: true,
  },
  {
    id: "hf:black-forest-labs/FLUX.2-klein-4B",
    provider: "huggingface",
    owner: "black-forest-labs",
    name: "FLUX.2-klein-4B",
    displayName: "FLUX.2 Klein 4B",
    description: "Edita a foto. No máximo 8 passos. Menos nítido do que o Kontext.",
    type: "image",
    tags: ["image", "edit"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-image",
    providerId: "fal-ai/flux-2/klein/4b/distilled/edit",
    needsImage: true,
  },
  {
    id: "hf:black-forest-labs/FLUX.1-Kontext-dev",
    provider: "huggingface",
    owner: "black-forest-labs",
    name: "FLUX.1-Kontext-dev",
    displayName: "FLUX.1 Kontext",
    description: "Edita a foto e segue a instrução. É o que melhor mantém a pessoa.",
    type: "image",
    tags: ["image", "edit"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-image",
    providerId: "fal-ai/flux-kontext/dev",
    needsImage: true,
  },
  {
    id: "hf:black-forest-labs/FLUX.2-klein-9B",
    provider: "huggingface",
    owner: "black-forest-labs",
    name: "FLUX.2-klein-9B",
    displayName: "FLUX.2 Klein 9B",
    description: "Edita a foto. No máximo 8 passos.",
    type: "image",
    tags: ["image", "edit"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-image",
    providerId: "fal-ai/flux-2/klein/9b/edit",
    needsImage: true,
  },
  {
    id: "hf:Wan-AI/Wan2.2-I2V-A14B",
    provider: "huggingface",
    owner: "Wan-AI",
    name: "Wan2.2-I2V-A14B",
    displayName: "Wan 2.2 I2V",
    description: "Anima a foto anexada. Sem foto, não gera.",
    type: "video",
    tags: ["video"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-video",
    providerId: "fal-ai/wan/v2.2-a14b/image-to-video",
    needsImage: true,
  },
  {
    id: "hf:Lightricks/LTX-2",
    provider: "huggingface",
    owner: "Lightricks",
    name: "LTX-2",
    displayName: "LTX-2",
    description: "Anima a foto anexada. O LTX-Video antigo não tem endpoint.",
    type: "video",
    tags: ["video"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-video",
    providerId: "fal-ai/ltx-2-19b/distilled/image-to-video",
    needsImage: true,
  },
];

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

function aspectField(video: boolean, original: boolean): ModelField {
  return {
    key: "aspect_ratio",
    label: "Formato",
    kind: "enum",
    required: false,
    enumValues: original ? ["original", ...ASPECTS] : ASPECTS,
    defaultValue: original ? "original" : video ? "16:9" : "1:1",
    prominent: true,
    lora: false,
  };
}

export function maxSteps(model: HfModel): number {
  if (model.endpoint?.handler === "dreamshaper") return 12;
  if (model.providerId.includes("schnell")) return 4;
  if (model.providerId.includes("z-image") || model.providerId.includes("klein")) return 8;
  if (model.providerId.includes("kontext")) return 35;
  return 40;
}

function stepField(model: HfModel): ModelField {
  const available =
    model.endpoint?.handler === "dreamshaper"
      ? [4, 6, 8, 10, 12]
      : model.endpoint?.handler
        ? [16, 28, 35, 40]
        : [4, 8, 16, 28, 35, 40];
  const choices = available.filter((n) => n <= maxSteps(model)).map(String);
  return {
    key: "steps",
    label: "Passos",
    kind: "enum",
    required: false,
    enumValues: choices,
    defaultValue: choices[choices.length - 1],
    prominent: true,
    lora: false,
  };
}

function guidanceField(): ModelField {
  return {
    key: "guidance",
    label: "Texto",
    kind: "enum",
    required: false,
    enumValues: ["Baixa", "Média", "Alta"],
    defaultValue: "Média",
    prominent: true,
    lora: false,
  };
}

function strengthField(): ModelField {
  return {
    key: "strength",
    label: "Mudança",
    kind: "enum",
    required: false,
    enumValues: ["Suave", "Média", "Forte"],
    defaultValue: "Média",
    prominent: true,
    lora: false,
  };
}

function keepField(key: string, label: string): ModelField {
  return {
    key,
    label,
    kind: "boolean",
    required: false,
    defaultValue: true,
    prominent: true,
    lora: false,
  };
}

export function hfFields(model: HfModel): ModelField[] {
  const usesPhoto = model.task === "image-to-image" || model.task === "image-to-video";
  const video = model.task === "text-to-video" || model.task === "image-to-video";
  const guided =
    Boolean(model.endpoint) ||
    model.providerId.includes("qwen-image") ||
    model.providerId.includes("kontext");
  const fields: ModelField[] = [
    aspectField(video && !usesPhoto, usesPhoto),
    video
      ? {
          key: "quality",
          label: "Qualidade",
          kind: "enum",
          required: false,
          enumValues: ["480p", "720p"],
          defaultValue: "720p",
          prominent: true,
          lora: false,
        }
      : stepField(model),
  ];
  if (guided && !video) fields.push(guidanceField());
  if (model.endpoint?.handler) fields.push(strengthField());
  if (model.endpoint) {
    fields.push({
      key: "negative_prompt",
      label: "Evitar na imagem",
      kind: "string",
      required: false,
      description: "Elementos, defeitos ou estilos que não devem aparecer.",
      defaultValue:
        "low quality, blurry, cropped, out of frame, distorted anatomy, deformed body, duplicate limbs, extra limbs, missing limbs, twisted torso, malformed hands, extra fingers, fused fingers, watermark, text",
      prominent: false,
      lora: false,
    });
  }
  if (usesPhoto) {
    fields.push(keepField("keep_face", "Manter rosto"));
    fields.push(keepField("keep_body", "Manter corpo"));
    fields.push(keepField("keep_clothes", "Manter roupa"));
    fields.push({
      key: "image",
      label: "Foto",
      kind: "image",
      required: true,
      prominent: false,
      lora: false,
    });
  }
  return fields;
}

export function hfModel(id: string): HfModel | undefined {
  return HF_MODELS.find((model) => model.id === id);
}

export function isHfModel(id: string | undefined): boolean {
  return Boolean(id && id.startsWith("hf:"));
}

export function isDedicatedHfImageEditor(id: string | undefined): boolean {
  const model = id ? hfModel(id) : undefined;
  return Boolean(model?.endpoint?.handler && model.task === "image-to-image");
}

export function dedicatedHfEditorMaxPixels(id: string | undefined): number {
  return hfModel(id)?.endpoint?.handler === "dreamshaper" ? 1024 : 768;
}

function normalizedPrompt(prompt: string): string {
  return prompt
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function resolveHfValues(
  id: string,
  prompt: string,
  values: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (hfModel(id)?.task !== "image-to-image") return values;
  const text = normalizedPrompt(prompt);
  const resolved = { ...values };

  const changesClothes =
    /\b(nude|naked|undress(?:ed)?|topless|lingerie|bikini|swimsuit|nu|nua|nudez|despir|sem roupa)\b/.test(
      text,
    ) ||
    /\b(change|replace|remove|wear|dress|trocar|mudar|remover|vestir)\b.{0,32}\b(clothes?|clothing|outfit|dress|shirt|jacket|suit|roupa|vestido|camisa|casaco|fato)\b/.test(
      text,
    );
  const changesBody =
    /\b(muscular|slimmer|fatter|thin body|different body|new pose|different pose|mais musculoso|mais magro|mais gordo|mudar corpo|trocar corpo|nova pose)\b/.test(
      text,
    );
  const changesFace =
    /\b(change|replace|swap|mudar|trocar)\b.{0,24}\b(face|rosto|identity|identidade)\b/.test(text);

  if (changesClothes) resolved.keep_clothes = false;
  if (changesBody) resolved.keep_body = false;
  if (changesFace) resolved.keep_face = false;
  return resolved;
}

export function hfSize(aspect: string): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1344, height: 768 };
  if (aspect === "9:16") return { width: 768, height: 1344 };
  if (aspect === "4:3") return { width: 1152, height: 864 };
  if (aspect === "3:4") return { width: 864, height: 1152 };
  return { width: 1024, height: 1024 };
}
