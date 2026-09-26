import { createServerFn } from "@tanstack/react-start";
import type { CatalogModel, ModelField } from "./catalog";
import type {
  EnhanceInput,
  GenerateImageInput,
  StartVideoInput,
} from "./types";

export const getImagineStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isImagineAvailable } = await import("./xai.server");
    return { available: isImagineAvailable() };
  },
);

export const enhanceImaginePrompt = createServerFn({ method: "POST" })
  .validator((data: EnhanceInput) => data)
  .handler(async ({ data }) => {
    const { enhancePrompt } = await import("./xai.server");
    return enhancePrompt(data);
  });

export const generateImagineImage = createServerFn({ method: "POST" })
  .validator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const { generateImage } = await import("./xai.server");
    return generateImage(data);
  });

export const startImagineVideo = createServerFn({ method: "POST" })
  .validator((data: StartVideoInput) => data)
  .handler(async ({ data }) => {
    const { startVideo } = await import("./xai.server");
    return startVideo(data);
  });

export const pollImagineVideo = createServerFn({ method: "POST" })
  .validator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    const { pollVideoRequest } = await import("./xai.server");
    return pollVideoRequest(data.requestId);
  });

export const searchImagineModels = createServerFn({ method: "POST" })
  .validator((data: { query?: string }) => ({ query: data?.query?.slice(0, 80) }))
  .handler(async ({ data }) => {
    const { searchCatalog } = await import("./catalog.server");
    const models = await searchCatalog(data.query);
    return { models };
  });

export const describeImagineModel = createServerFn({ method: "POST" })
  .validator((data: { modelId: string }) => ({ modelId: String(data?.modelId || "").slice(0, 160) }))
  .handler(async ({ data }) => {
    const { describeModel } = await import("./catalog.server");
    return describeModel(data.modelId);
  });

export const startCatalogGeneration = createServerFn({ method: "POST" })
  .validator(
    (data: {
      modelId: string;
      prompt: string;
      values?: Record<string, string | number | boolean>;
      imageUrl?: string;
      lastFrameUrl?: string;
      videoUrl?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { startCatalogModel } = await import("./catalog.server");
    return startCatalogModel({
      modelId: data.modelId,
      prompt: data.prompt,
      values: data.values || {},
      imageUrl: data.imageUrl,
      lastFrameUrl: data.lastFrameUrl,
      videoUrl: data.videoUrl,
    });
  });

export type { CatalogModel, ModelField };
