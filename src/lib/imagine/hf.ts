import type { CatalogModel, ModelField } from "./catalog";

export type HfTask = "text-to-image" | "image-to-image" | "text-to-video";

export type HfModel = CatalogModel & {
  task: HfTask;
  providerId: string;
  needsImage: boolean;
};

export const HF_MODELS: HfModel[] = [
  {
    id: "hf:black-forest-labs/FLUX.1-schnell",
    provider: "huggingface",
    owner: "black-forest-labs",
    name: "FLUX.1-schnell",
    displayName: "FLUX.1 Schnell",
    description: "Texto para imagem. Rápido. Licença Apache 2.0.",
    type: "image",
    tags: ["image"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "text-to-image",
    providerId: "fal-ai/flux/schnell",
    needsImage: false,
  },
  {
    id: "hf:Tongyi-MAI/Z-Image-Turbo",
    provider: "huggingface",
    owner: "Tongyi-MAI",
    name: "Z-Image-Turbo",
    displayName: "Z-Image Turbo",
    description: "Texto para imagem. Licença Apache 2.0.",
    type: "image",
    tags: ["image"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "text-to-image",
    providerId: "fal-ai/z-image/turbo",
    needsImage: false,
  },
  {
    id: "hf:Qwen/Qwen-Image",
    provider: "huggingface",
    owner: "Qwen",
    name: "Qwen-Image",
    displayName: "Qwen Image",
    description: "Texto para imagem. Licença Apache 2.0.",
    type: "image",
    tags: ["image"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "text-to-image",
    providerId: "fal-ai/qwen-image",
    needsImage: false,
  },
  {
    id: "hf:Qwen/Qwen-Image-Edit",
    provider: "huggingface",
    owner: "Qwen",
    name: "Qwen-Image-Edit",
    displayName: "Qwen Image Edit",
    description: "Edita a foto que anexares. Sem foto, não gera.",
    type: "image",
    tags: ["image", "edit"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "image-to-image",
    providerId: "fal-ai/qwen-image-edit",
    needsImage: true,
  },
  {
    id: "hf:black-forest-labs/FLUX.2-klein-4B",
    provider: "huggingface",
    owner: "black-forest-labs",
    name: "FLUX.2-klein-4B",
    displayName: "FLUX.2 Klein 4B",
    description: "Edita a foto anexada. Licença Apache 2.0.",
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
    id: "hf:Wan-AI/Wan2.2-TI2V-5B",
    provider: "huggingface",
    owner: "Wan-AI",
    name: "Wan2.2-TI2V-5B",
    displayName: "Wan 2.2 5B",
    description: "Texto para vídeo, cerca de 5 segundos. Licença Apache 2.0. A foto não entra neste endpoint.",
    type: "video",
    tags: ["video"],
    official: true,
    supportsLora: false,
    followsPrompt: true,
    pricingLabel: "Créditos Hugging Face",
    task: "text-to-video",
    providerId: "fal-ai/wan/v2.2-5b/text-to-video",
    needsImage: false,
  },
];

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export function hfModel(id: string): HfModel | undefined {
  return HF_MODELS.find((model) => model.id === id);
}

export function isHfModel(id: string | undefined): boolean {
  return Boolean(id && id.startsWith("hf:"));
}

export function hfFields(model: HfModel): ModelField[] {
  const aspect: ModelField = {
    key: "aspect_ratio",
    label: "Formato",
    kind: "enum",
    required: false,
    enumValues: ASPECTS,
    defaultValue: model.task === "text-to-video" ? "16:9" : "1:1",
    prominent: true,
    lora: false,
  };
  if (model.task === "text-to-video") return [aspect];
  return [aspect];
}

export function hfSize(aspect: string): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1024, height: 576 };
  if (aspect === "9:16") return { width: 576, height: 1024 };
  if (aspect === "4:3") return { width: 1024, height: 768 };
  if (aspect === "3:4") return { width: 768, height: 1024 };
  return { width: 1024, height: 1024 };
}
