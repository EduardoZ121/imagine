import type {
  ImageAspectRatio,
  ImageQuality,
  ImageResolution,
  MediaKind,
  VideoAspectRatio,
  VideoResolution,
} from "./types";

export const APP_NAME = "Imagine";

export const IMAGE_MODEL = "xai/grok-imagine-image-2";
export const VIDEO_MODEL = "xai/grok-imagine-video-1.5";
export const VIDEO_EDIT_MODEL = "xai/grok-imagine-video";

export const MAX_IMAGE_REFS = 5;
export const MAX_VIDEO_REFS = 7;
export const MAX_PROMPT = 4000;
export const MAX_IMAGE_N = 4;
export const MAX_DATA_URL_CHARS = 12_000_000;

export const VIDEO_DURATION_MIN = 6;
export const VIDEO_DURATION_MAX = 15;
export const EXTEND_DURATION_MIN = 2;
export const EXTEND_DURATION_MAX = 10;

export type FormatPreset = {
  id: string;
  label: string;
  hint: string;
  imageAspect: ImageAspectRatio;
  videoAspect: VideoAspectRatio;
  platforms: string;
};

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "reels",
    label: "Reels / Shorts",
    hint: "9:16",
    imageAspect: "9:16",
    videoAspect: "9:16",
    platforms: "Instagram Reels, TikTok, YouTube Shorts, Stories",
  },
  {
    id: "youtube",
    label: "YouTube",
    hint: "16:9",
    imageAspect: "16:9",
    videoAspect: "16:9",
    platforms: "YouTube, widescreen",
  },
  {
    id: "feed",
    label: "Feed 1:1",
    hint: "1:1",
    imageAspect: "1:1",
    videoAspect: "1:1",
    platforms: "Instagram, X, thumbnail",
  },
  {
    id: "portrait",
    label: "Retrato",
    hint: "3:4",
    imageAspect: "3:4",
    videoAspect: "3:4",
    platforms: "Pinterest, retrato",
  },
  {
    id: "photo",
    label: "Foto 3:2",
    hint: "3:2",
    imageAspect: "3:2",
    videoAspect: "3:2",
    platforms: "Fotografia landscape",
  },
  {
    id: "tall",
    label: "Foto 2:3",
    hint: "2:3",
    imageAspect: "2:3",
    videoAspect: "2:3",
    platforms: "Fotografia portrait",
  },
  {
    id: "classic",
    label: "Clássico",
    hint: "4:3",
    imageAspect: "4:3",
    videoAspect: "4:3",
    platforms: "Apresentações",
  },
];

export const IMAGE_ONLY_FORMATS: {
  id: string;
  label: string;
  hint: string;
  aspect: ImageAspectRatio;
}[] = [
  { id: "cinema", label: "Cinema", hint: "21:9", aspect: "21:9" },
  { id: "ultrawide", label: "Ultra", hint: "5:2", aspect: "5:2" },
  { id: "iphone", label: "iPhone", hint: "9:19.5", aspect: "9:19.5" },
  { id: "auto", label: "Auto", hint: "auto", aspect: "auto" },
];

export const IMAGE_RESOLUTIONS: { id: ImageResolution; label: string }[] = [
  { id: "1k", label: "1K" },
  { id: "2k", label: "2K" },
];
export const VIDEO_RESOLUTIONS: { id: VideoResolution; label: string }[] = [
  { id: "480p", label: "480p" },
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
];
export const IMAGE_QUALITIES: { id: ImageQuality; label: string }[] = [
  { id: "low", label: "Rápida" },
  { id: "medium", label: "Alta" },
];

export const PROMPT_PLACEHOLDERS: Record<"image" | "video", string> = {
  image: "Descreve a imagem…",
  video: "Descreve o movimento, a câmara e o ambiente…",
};

export const EXAMPLE_PROMPTS: { kind: MediaKind; label: string; prompt: string }[] = [
  {
    kind: "image",
    label: "Lisboa ao entardecer",
    prompt:
      "Rua estreita em Lisboa ao entardecer, fachadas de azulejo azul e branco, luz dourada rasante, pavimento molhado, câmara baixa, still cinematográfico, granulação suave de filme.",
  },
  {
    kind: "image",
    label: "Retrato em estúdio",
    prompt:
      "Retrato de estúdio, luz suave de borboleta, fundo cinza quente, pele com textura real, olhar directo à câmara, 85mm, profundidade de campo curta.",
  },
  {
    kind: "video",
    label: "Travelling de néon",
    prompt:
      "A câmara avança lentamente por um corredor de néon molhado pela chuva. Reflexos no asfalto, vapor no ar, uma figura caminha em direcção à luz ao fundo. Um único plano contínuo.",
  },
  {
    kind: "video",
    label: "Slow motion praia",
    prompt:
      "Câmara lenta numa praia ao nascer do sol: o vento move o cabelo e o tecido, ondas suaves ao fundo, luz quente de contra-luz, steadicam suave a circundar o sujeito.",
  },
];

export type ResolvedFormat = {
  id: string;
  label: string;
  hint: string;
  aspect: ImageAspectRatio | VideoAspectRatio;
  platforms: string;
};

export function resolveFormat(id: string, kind: MediaKind): ResolvedFormat {
  const preset = FORMAT_PRESETS.find((item) => item.id === id);
  if (preset) {
    return {
      id: preset.id,
      label: preset.label,
      hint: preset.hint,
      aspect: kind === "video" ? preset.videoAspect : preset.imageAspect,
      platforms: preset.platforms,
    };
  }
  const extra = IMAGE_ONLY_FORMATS.find((item) => item.id === id);
  if (extra && kind === "image") {
    return {
      id: extra.id,
      label: extra.label,
      hint: extra.hint,
      aspect: extra.aspect,
      platforms: extra.label,
    };
  }
  return {
    id: "reels",
    label: "Reels / Shorts",
    hint: "9:16",
    aspect: "9:16",
    platforms: "Instagram Reels, TikTok, YouTube Shorts, Stories",
  };
}

export function formatsFor(kind: MediaKind): { id: string; label: string; hint: string }[] {
  if (kind === "video") {
    return FORMAT_PRESETS.map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
    }));
  }
  return [
    ...FORMAT_PRESETS.map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
    })),
    ...IMAGE_ONLY_FORMATS,
  ];
}
