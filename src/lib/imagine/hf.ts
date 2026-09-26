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
    description: "Texto para imagem, rascunho rápido. Segue o texto pior do que o Qwen Image.",
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
    description: "Texto para imagem, rápido. Menos fiel ao texto do que o Qwen Image.",
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
    description: "Texto para imagem. Segue o texto melhor do que o Schnell.",
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

function qualityField(): ModelField {
  return {
    key: "quality",
    label: "Qualidade",
    kind: "enum",
    required: false,
    enumValues: ["Rápida", "Equilibrada", "Alta"],
    defaultValue: "Alta",
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

export function hfFields(model: HfModel): ModelField[] {
  const edit = model.task === "image-to-image";
  const qwen = model.providerId.includes("qwen-image") && !model.providerId.includes("klein");
  const fields: ModelField[] = [aspectField(model.task === "text-to-video", edit), qualityField()];
  if (qwen) fields.push(guidanceField());
  if (edit) {
    fields.push({
      key: "keep_subject",
      label: "Manter rosto",
      kind: "boolean",
      required: false,
      defaultValue: true,
      prominent: true,
      lora: false,
    });
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

export function hfSize(aspect: string): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1344, height: 768 };
  if (aspect === "9:16") return { width: 768, height: 1344 };
  if (aspect === "4:3") return { width: 1152, height: 864 };
  if (aspect === "3:4") return { width: 864, height: 1152 };
  return { width: 1024, height: 1024 };
}
