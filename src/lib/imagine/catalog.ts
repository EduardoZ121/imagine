export const GROK_MODEL_ID = "grok";

export type CatalogProvider = "grok" | "replicate";
export type CatalogType = "image" | "video" | "upscale" | "other";

export type CatalogModel = {
  id: string;
  provider: CatalogProvider;
  owner: string;
  name: string;
  displayName: string;
  description: string;
  type: CatalogType;
  tags: string[];
  thumbnail?: string;
  official?: boolean;
  supportsLora: boolean;
  followsPrompt?: boolean;
  url?: string;
  runCount?: number;
  pricingLabel: string;
};

export type ModelField = {
  key: string;
  label: string;
  kind: "string" | "number" | "integer" | "boolean" | "enum" | "image" | "video";
  required: boolean;
  description?: string;
  enumValues?: string[];
  minimum?: number;
  maximum?: number;
  defaultValue?: string | number | boolean;
  multiple?: boolean;
  numeric?: boolean;
  prominent?: boolean;
  lora: boolean;
};

export const GROK_CATALOG_MODEL: CatalogModel = {
  id: GROK_MODEL_ID,
  provider: "grok",
  owner: "xai",
  name: "grok-imagine",
  displayName: "Grok Imagine",
  description: "Modelo atual do site. Imagem, vídeo, referência, editar e estender.",
  type: "image",
  tags: ["image", "video", "edit"],
  official: true,
  supportsLora: false,
  followsPrompt: true,
  pricingLabel: "Preço indisponível nesta API",
};

export function isGrokModel(id: string | undefined): boolean {
  return !id || id === GROK_MODEL_ID;
}
