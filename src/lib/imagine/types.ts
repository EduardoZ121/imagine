export type MediaKind = "image" | "video";
export type StudioAction = "generate" | "edit" | "extend";
export type ImageQuality = "low" | "medium";
export type ImageResolution = "1k" | "2k";
export type VideoResolution = "480p" | "720p" | "1080p";

export type ImageAspectRatio =
  | "auto"
  | "1:1"
  | "3:4"
  | "4:3"
  | "9:16"
  | "16:9"
  | "2:3"
  | "3:2"
  | "9:19.5"
  | "19.5:9"
  | "9:20"
  | "20:9"
  | "1:2"
  | "2:1"
  | "21:9"
  | "5:2";

export type VideoAspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3";

export type AspectRatio = ImageAspectRatio | VideoAspectRatio;

export type RefRole = "ref" | "start" | "last";

export type RefImage = {
  id: string;
  url: string;
  name?: string;
  role: RefRole;
};

export type SourceVideo = {
  id: string;
  url: string;
  name?: string;
};

export type GalleryItem = {
  id: string;
  kind: MediaKind;
  prompt: string;
  enhancedPrompt: string;
  aspectRatio: string;
  resolution: string;
  duration?: number;
  url: string;
  remoteUrl?: string;
  createdAt: number;
  status?: "done" | "pending" | "failed";
  progress?: number;
  requestId?: string;
  error?: string;
  provider?: "grok" | "replicate" | "huggingface";
  modelId?: string;
  modelName?: string;
  runtimeSeconds?: number;
};

export type EnhanceInput = {
  prompt: string;
  kind: MediaKind;
  action: StudioAction;
  aspectRatio: string;
  duration?: number;
  hasReferences: boolean;
  hasStartFrame: boolean;
  formatLabel: string;
};

export type EnhanceResult =
  | { ok: true; prompt: string }
  | { ok: false; error: string };

export type GenerateImageInput = {
  prompt: string;
  aspectRatio: ImageAspectRatio;
  resolution: ImageResolution;
  quality: ImageQuality;
  n: number;
  references: string[];
};

export type GenerateImageResult =
  | { ok: true; urls?: string[]; requestIds?: string[] }
  | { ok: false; error: string };

export type StartVideoInput = {
  prompt: string;
  action: "generate" | "edit" | "extend";
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  duration: number;
  generateAudio?: boolean;
  startFrame?: string;
  lastFrame?: string;
  references: string[];
  sourceVideo?: string;
};

export type StartVideoResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

export type PollVideoResult =
  | {
      ok: true;
      status: "pending" | "done" | "failed" | "expired";
      progress: number;
      url?: string;
      duration?: number;
      error?: string;
      stage?: "frame" | "image";
      runtimeSeconds?: number;
    }
  | { ok: false; error: string };
