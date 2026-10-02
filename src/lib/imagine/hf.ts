import type { CatalogModel, ModelField } from "./catalog";

export type HfTask = "text-to-image" | "image-to-image" | "text-to-video" | "image-to-video";

export type HfModel = CatalogModel & {
  task: HfTask;
  providerId: string;
  needsImage: boolean;
  endpoint?: {
    env: string;
    fallbackUrl: string;
    handler?: "dreamshaper" | "instruct-pix2pix";
  };
};

export const HF_MODELS: HfModel[] = [
  {
    id: "hf:Eddy12253/imagine-instruct-pix2pix",
    provider: "huggingface",
    owner: "Eddy12253",
    name: "imagine-instruct-pix2pix",
    displayName: "InstructPix2Pix",
    description:
      "Edita a foto seguindo uma instrução directa. Endpoint dedicado sem filtro do fornecedor.",
    type: "image",
    tags: ["image", "edit", "18+"],
    official: false,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Endpoint dedicado Hugging Face",
    task: "image-to-image",
    providerId: "timbrooks/instruct-pix2pix",
    needsImage: true,
    endpoint: {
      env: "HF_INSTRUCT_I2I_ENDPOINT_URL",
      fallbackUrl: "https://6ab9392b9ec415b652acd801.endpoints.huggingface.cloud",
      handler: "instruct-pix2pix",
    },
  },
  {
    id: "hf:Lykon/dreamshaper-8",
    provider: "huggingface",
    owner: "Lykon",
    name: "dreamshaper-8",
    displayName: "DreamShaper 8 Img2Img",
    description:
      "Reimagina a foto sem filtro do fornecedor. Descreve o resultado final; Suave preserva mais.",
    type: "image",
    tags: ["image", "edit", "18+"],
    official: false,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Endpoint dedicado Hugging Face",
    task: "image-to-image",
    providerId: "Lykon/dreamshaper-8",
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
  if (model.providerId.includes("schnell")) return 4;
  if (model.providerId.includes("z-image") || model.providerId.includes("klein")) return 8;
  if (model.providerId.includes("kontext")) return 35;
  return 40;
}

function stepField(model: HfModel): ModelField {
  const available = model.endpoint?.handler ? [16, 28, 35, 40] : [4, 8, 16, 28, 35, 40];
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
      defaultValue: "low quality, blurry, deformed, extra fingers, watermark, text",
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

export function hfSize(aspect: string): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1344, height: 768 };
  if (aspect === "9:16") return { width: 768, height: 1344 };
  if (aspect === "4:3") return { width: 1152, height: 864 };
  if (aspect === "3:4") return { width: 864, height: 1152 };
  return { width: 1024, height: 1024 };
}
