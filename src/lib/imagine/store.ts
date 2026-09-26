import { toast } from "sonner";
import { create } from "zustand";
import {
  EXAMPLE_PROMPTS,
  IMAGE_ONLY_FORMATS,
  MAX_IMAGE_N,
  MAX_IMAGE_REFS,
  MAX_PROMPT,
  MAX_VIDEO_REFS,
  resolveFormat,
} from "./constants";
import {
  describeImagineModel,
  enhanceImaginePrompt,
  generateImagineImage,
  getImagineStatus,
  pollImagineVideo,
  startCatalogGeneration,
  startImagineVideo,
} from "./functions";
import { GROK_MODEL_ID, isGrokModel, type ModelField } from "./catalog";
import {
  cacheRemoteMedia,
  deleteBlob,
  getBlob,
  loadGalleryMeta,
  saveGalleryMeta,
} from "./gallery";
import { compressImageFile, downloadFromUrl, filenameFor, newId, sleep, videoFileToDataUrl } from "./media";
import type {
  GalleryItem,
  ImageAspectRatio,
  ImageQuality,
  ImageResolution,
  MediaKind,
  RefImage,
  RefRole,
  SourceVideo,
  StudioAction,
  VideoAspectRatio,
  VideoResolution,
} from "./types";

const ENHANCE_KEY = "imagine.enhance.v1";
const CATALOG_KEY = "imagine.catalog.v1";
const FAVORITES_KEY = "imagine.favorites.v1";

function persist(items: GalleryItem[]) {
  saveGalleryMeta(items);
}

function shownError(raw: string | undefined): string {
  if (!raw) return "A geração falhou. Tenta de novo.";
  if (raw.startsWith("A moderação") || raw.startsWith("Este modelo") || raw.startsWith("Crédito não")) {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes("modera") ||
    lower.includes("sensitive") ||
    lower.includes("flagged") ||
    lower.includes("e005") ||
    lower.includes("inappropriate")
  ) {
    return "Este pedido foi bloqueado pela moderação. Muda o prompt ou a imagem.";
  }
  if (
    lower.includes("unexpected token") ||
    lower.includes("syntaxerror") ||
    lower.includes("json") ||
    lower.includes("failed to fetch") ||
    lower.includes("token") ||
    lower.includes("api key") ||
    lower.includes("code") ||
    lower.includes("replicate") ||
    lower.includes("{") ||
    raw.length > 180
  ) {
    return "A geração falhou. Tenta outra vez.";
  }
  return raw;
}

function readEnhancePref(): boolean {
  try {
    const raw = localStorage.getItem(ENHANCE_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

function reusableUrl(item: GalleryItem): string {
  if (item.remoteUrl) return item.remoteUrl;
  if (item.url && !item.url.startsWith("blob:")) return item.url;
  return "";
}

type StudioState = {
  kind: MediaKind;
  action: StudioAction;
  prompt: string;
  enhancedPrompt: string | null;
  formatId: string;
  duration: number;
  extendDuration: number;
  imageResolution: ImageResolution;
  videoResolution: VideoResolution;
  quality: ImageQuality;
  imageCount: number;
  generateAudio: boolean;
  enhance: boolean;
  refs: RefImage[];
  sourceVideo: SourceVideo | null;
  gallery: GalleryItem[];
  selectedId: string | null;
  busy: boolean;
  busyLabel: string;
  error: string | null;
  available: boolean | null;
  dragging: boolean;
  hydrated: boolean;
  catalogId: string;
  catalogName: string;
  catalogOfficial?: boolean;
  catalogFields: ModelField[];
  catalogValues: Record<string, string | number | boolean>;
  favorites: string[];
  setKind: (kind: MediaKind) => void;
  setAction: (action: StudioAction) => void;
  setPrompt: (prompt: string) => void;
  setFormatId: (id: string) => void;
  setDuration: (n: number) => void;
  setExtendDuration: (n: number) => void;
  setImageResolution: (v: ImageResolution) => void;
  setVideoResolution: (v: VideoResolution) => void;
  setQuality: (v: ImageQuality) => void;
  setImageCount: (n: number) => void;
  setGenerateAudio: (v: boolean) => void;
  setEnhance: (v: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setDragging: (v: boolean) => void;
  hydrate: () => Promise<void>;
  addFiles: (files: File[] | FileList) => Promise<void>;
  removeRef: (id: string) => void;
  setRefRole: (id: string, role: RefRole) => void;
  clearSourceVideo: () => void;
  useAsStartFrame: (item: GalleryItem) => void;
  useAsReference: (item: GalleryItem) => void;
  useToExtend: (item: GalleryItem) => void;
  useToEdit: (item: GalleryItem) => void;
  downloadItem: (item: GalleryItem) => void;
  deleteItem: (id: string) => Promise<void>;
  fillExample: (label: string) => void;
  generate: () => Promise<void>;
  setCatalogModel: (id: string) => Promise<void>;
  setCatalogValue: (key: string, value: string | number | boolean) => void;
  toggleFavorite: (id: string) => void;
};

type SetState = (
  partial: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>),
) => void;

async function resolveDisplay(item: GalleryItem): Promise<string | undefined> {
  const blob = await getBlob(item.id);
  if (blob) return URL.createObjectURL(blob);
  const remote = item.remoteUrl || item.url;
  if (remote && !remote.startsWith("blob:")) {
    return cacheRemoteMedia(item.id, remote);
  }
  return undefined;
}

export const useStudio = create<StudioState>((set, get) => ({
  kind: "video",
  action: "generate",
  prompt: "",
  enhancedPrompt: null,
  formatId: "reels",
  duration: 10,
  extendDuration: 6,
  imageResolution: "2k",
  videoResolution: "720p",
  quality: "medium",
  imageCount: 1,
  generateAudio: true,
  enhance: true,
  refs: [],
  sourceVideo: null,
  gallery: [],
  selectedId: null,
  busy: false,
  busyLabel: "",
  error: null,
  available: null,
  dragging: false,
  hydrated: false,
  catalogId: GROK_MODEL_ID,
  catalogName: "Grok Imagine",
  catalogOfficial: true,
  catalogFields: [],
  catalogValues: {},
  favorites: [],

  setKind: (kind) => {
    const state = get();
    if (kind === "video") {
      const extra = IMAGE_ONLY_FORMATS.some((item) => item.id === state.formatId);
      set({
        kind,
        formatId: extra ? "reels" : state.formatId,
        action: state.sourceVideo ? state.action : "generate",
      });
    } else {
      set({
        kind,
        action: state.refs.length ? "edit" : "generate",
        sourceVideo: null,
      });
    }
  },
  setAction: (action) => set({ action }),
  setPrompt: (prompt) => set({ prompt: prompt.slice(0, MAX_PROMPT), error: null }),
  setFormatId: (formatId) => set({ formatId }),
  setDuration: (duration) => set({ duration: Math.min(15, Math.max(6, duration)) }),
  setExtendDuration: (extendDuration) =>
    set({ extendDuration: Math.min(10, Math.max(2, extendDuration)) }),
  setImageResolution: (imageResolution) => set({ imageResolution }),
  setVideoResolution: (videoResolution) => set({ videoResolution }),
  setQuality: (quality) => set({ quality }),
  setImageCount: (imageCount) =>
    set({ imageCount: Math.min(MAX_IMAGE_N, Math.max(1, imageCount)) }),
  setGenerateAudio: (generateAudio) => set({ generateAudio }),
  setEnhance: (enhance) => {
    try {
      localStorage.setItem(ENHANCE_KEY, enhance ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ enhance });
  },
  setSelectedId: (selectedId) => set({ selectedId }),
  setDragging: (dragging) => set({ dragging }),

  hydrate: async () => {
    if (get().hydrated) return;
    let favorites: string[] = [];
    let catalogId = GROK_MODEL_ID;
    let catalogName = "Grok Imagine";
    let catalogOfficial: boolean | undefined = true;
    try {
      const fav = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as unknown;
      if (Array.isArray(fav)) favorites = fav.filter((id) => typeof id === "string").slice(0, 24);
      const saved = JSON.parse(localStorage.getItem(CATALOG_KEY) || "null") as {
        id?: string;
        name?: string;
        official?: boolean;
      } | null;
      if (saved?.id && saved.name) {
        catalogId = saved.id;
        catalogName = saved.name;
        catalogOfficial = saved.official;
      }
    } catch {
      catalogId = GROK_MODEL_ID;
    }
    set({
      enhance: readEnhancePref(),
      available: true,
      favorites,
      catalogId,
      catalogName,
      catalogOfficial,
    });
    const meta = loadGalleryMeta();
    set({ gallery: meta, hydrated: true });
    if (!isGrokModel(catalogId)) void get().setCatalogModel(catalogId);
    try {
      const status = await getImagineStatus();
      set({ available: status.available !== false });
    } catch {
      set({ available: true });
    }
    for (const item of meta) {
      if (item.requestId && item.status === "pending") {
        void pollUntilDone(item.id, item.requestId, set, get);
      }
      const display = await resolveDisplay(item);
      if (display) {
        set((s) => ({
          gallery: s.gallery.map((g) => (g.id === item.id ? { ...g, url: display } : g)),
        }));
      }
    }
  },

  addFiles: async (files) => {
    const list = Array.from(files);
    for (const file of list) {
      try {
        if (file.type.startsWith("video/")) {
          const url = await videoFileToDataUrl(file);
          set({
            sourceVideo: { id: newId(), url, name: file.name },
            kind: "video",
            action: "extend",
          });
          toast.success("Vídeo pronto a estender ou editar.");
        } else if (file.type.startsWith("image/")) {
          const url = await compressImageFile(file);
          const state = get();
          const hasStart = state.refs.some((r) => r.role === "start");
          const refCount = state.refs.filter((r) => r.role === "ref").length;
          const maxRefs = state.kind === "video" ? MAX_VIDEO_REFS : MAX_IMAGE_REFS;
          let role: RefRole = "ref";
          if (state.kind === "video" && !hasStart) role = "start";
          else if (refCount >= maxRefs) {
            toast.error(
              `Máximo de ${maxRefs} ${state.kind === "video" ? "referências de vídeo" : "fotos de referência"}.`,
            );
            continue;
          }
          set({
            refs: [...state.refs, { id: newId(), url, name: file.name, role }],
            action: state.kind === "image" ? "edit" : state.action,
          });
        } else {
          toast.error("Usa JPEG, PNG, WebP ou MP4.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao ler o ficheiro.");
      }
    }
  },

  removeRef: (id) =>
    set((s) => ({
      refs: s.refs.filter((r) => r.id !== id),
      action:
        s.kind === "image" && s.refs.filter((r) => r.id !== id).length === 0
          ? "generate"
          : s.action,
    })),

  setRefRole: (id, role) =>
    set((s) => ({
      refs: s.refs.map((r) => {
        if (r.id === id) return { ...r, role };
        if ((role === "start" || role === "last") && r.role === role) {
          return { ...r, role: "ref" };
        }
        return r;
      }),
    })),

  clearSourceVideo: () => set({ sourceVideo: null, action: "generate" }),

  useAsStartFrame: (item) => {
    const src = reusableUrl(item);
    if (!src) {
      toast.error("Esta imagem ainda não está pronta a reutilizar.");
      return;
    }
    set((s) => ({
      kind: "video",
      action: "generate",
      selectedId: null,
      refs: [
        { id: newId(), url: src, name: "início", role: "start" },
        ...s.refs.filter((r) => r.role !== "start"),
      ],
    }));
    toast.message("Fotograma inicial definido. Escreve o movimento e gera o vídeo.");
  },

  useAsReference: (item) => {
    const src = reusableUrl(item);
    if (!src) {
      toast.error("Esta imagem ainda não está pronta a reutilizar.");
      return;
    }
    set((s) => {
      const maxRefs = s.kind === "video" ? MAX_VIDEO_REFS : MAX_IMAGE_REFS;
      const refCount = s.refs.filter((r) => r.role === "ref").length;
      if (refCount >= maxRefs) {
        toast.error(`Máximo de ${maxRefs} referências.`);
        return {};
      }
      return {
        refs: [...s.refs, { id: newId(), url: src, name: "referência", role: "ref" as const }],
        action: s.kind === "image" ? "edit" : s.action,
        selectedId: null,
      };
    });
  },

  useToExtend: (item) => {
    const src = reusableUrl(item);
    if (!src) {
      toast.error("Este vídeo ainda não está pronto a estender.");
      return;
    }
    set({
      kind: "video",
      action: "extend",
      sourceVideo: { id: item.id, url: src, name: "clip" },
      selectedId: null,
    });
    toast.message("Vídeo pronto a estender. Diz o que acontece a seguir.");
  },

  useToEdit: (item) => {
    const src = reusableUrl(item);
    if (!src) {
      toast.error("Este vídeo ainda não está pronto a editar.");
      return;
    }
    set({
      kind: "video",
      action: "edit",
      sourceVideo: { id: item.id, url: src, name: "clip" },
      selectedId: null,
    });
    toast.message("Vídeo pronto a editar. Diz só o que muda.");
  },

  downloadItem: (item) => {
    const src = item.url || item.remoteUrl;
    if (!src) {
      toast.error("Ainda não há ficheiro para descarregar.");
      return;
    }
    downloadFromUrl(src, filenameFor(item.kind, item.id));
  },

  deleteItem: async (id) => {
    const item = get().gallery.find((g) => g.id === id);
    if (item?.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
    await deleteBlob(id);
    set((s) => {
      const gallery = s.gallery.filter((g) => g.id !== id);
      persist(gallery);
      return { gallery, selectedId: s.selectedId === id ? null : s.selectedId };
    });
  },

  fillExample: (label) => {
    const found = EXAMPLE_PROMPTS.find((e) => e.label === label);
    if (!found) return;
    set({ prompt: found.prompt, kind: found.kind });
  },

  setCatalogValue: (key, value) =>
    set((s) => ({ catalogValues: { ...s.catalogValues, [key]: value } })),

  toggleFavorite: (id) => {
    const next = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : [id, ...get().favorites].slice(0, 24);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    set({ favorites: next });
  },

  setCatalogModel: async (id) => {
    if (isGrokModel(id)) {
      try {
        localStorage.removeItem(CATALOG_KEY);
      } catch {
        /* ignore */
      }
      set({
        catalogId: GROK_MODEL_ID,
        catalogName: "Grok Imagine",
        catalogOfficial: true,
        catalogFields: [],
        catalogValues: {},
        error: null,
      });
      return;
    }
    try {
      const result = await describeImagineModel({ data: { modelId: id } });
      if (!result.ok) {
        toast.error(result.error);
        set({
          catalogId: GROK_MODEL_ID,
          catalogName: "Grok Imagine",
          catalogOfficial: true,
          catalogFields: [],
          error: result.error,
        });
        return;
      }
      const values: Record<string, string | number | boolean> = {};
      for (const field of result.fields) {
        if (field.defaultValue !== undefined && field.kind !== "image") values[field.key] = field.defaultValue;
      }
      try {
        localStorage.setItem(
          CATALOG_KEY,
          JSON.stringify({
            id: result.model.id,
            name: result.model.displayName,
            official: result.model.official,
          }),
        );
      } catch {
        /* ignore */
      }
      set({
        catalogId: result.model.id,
        catalogName: result.model.displayName,
        catalogOfficial: result.model.official,
        catalogFields: result.fields,
        catalogValues: values,
        kind: result.model.type === "video" ? "video" : "image",
        error: null,
      });
    } catch {
      toast.error("Não consegui abrir este modelo.");
    }
  },

  generate: async () => {
    const state = get();
    if (state.busy) return;
    const prompt = state.prompt.trim();
    const upscale = state.catalogFields.some((field) => field.key === "scale" || field.key === "face_enhance");
    if (!prompt && !(upscale && state.refs.length > 0 && !isGrokModel(state.catalogId))) {
      toast.error("Escreve um prompt.");
      return;
    }
    if (!isGrokModel(state.catalogId)) {
      await runCatalog(state, set, get);
      return;
    }
    if (
      state.kind === "video" &&
      (state.action === "extend" || state.action === "edit") &&
      !state.sourceVideo
    ) {
      toast.error("Escolhe um vídeo para estender ou editar.");
      return;
    }

    const format = resolveFormat(state.formatId, state.kind);
    const startFrame = state.refs.find((r) => r.role === "start");
    const lastFrame = state.refs.find((r) => r.role === "last");
    const references = state.refs.filter((r) => r.role === "ref");
    const duration = state.action === "extend" ? state.extendDuration : state.duration;

    set({
      busy: true,
      error: null,
      enhancedPrompt: null,
      busyLabel: "A interpretar o teu prompt…",
    });

    try {
      let finalPrompt = prompt;
      if (state.enhance) {
        try {
          const enhanced = await enhanceImaginePrompt({
            data: {
              prompt,
              kind: state.kind,
              action: state.action,
              aspectRatio: String(format.aspect),
              duration,
              hasReferences: references.length > 0,
              hasStartFrame: Boolean(startFrame),
              formatLabel: `${format.label} · ${format.platforms}`,
            },
          });
          if (enhanced.ok && enhanced.prompt) finalPrompt = enhanced.prompt;
        } catch {
          finalPrompt = prompt;
        }
      }
      set({ enhancedPrompt: finalPrompt });

      if (state.kind === "image") {
        set({ busyLabel: references.length ? "A editar a imagem…" : "A gerar a imagem…" });
        const imageRefs = [
          ...(startFrame ? [startFrame.url] : []),
          ...references.map((r) => r.url),
        ];
        const result = await generateImagineImage({
          data: {
            prompt: finalPrompt,
            aspectRatio: format.aspect as ImageAspectRatio,
            resolution: state.imageResolution,
            quality: state.quality,
            n: state.imageCount,
            references: imageRefs,
          },
        });
        if (!result.ok) {
          const error = shownError(result.error);
          set({ busy: false, busyLabel: "", error });
          toast.error(error);
          return;
        }
        const requestIds = result.requestIds ?? [];
        if (requestIds.length) {
          const created: GalleryItem[] = requestIds.map((requestId) => ({
            id: newId(),
            kind: "image",
            prompt,
            enhancedPrompt: finalPrompt,
            aspectRatio: String(format.aspect),
            resolution: state.imageResolution,
            url: "",
            createdAt: Date.now(),
            status: "pending",
            progress: 1,
            requestId,
            provider: "grok",
            modelId: GROK_MODEL_ID,
            modelName: "Grok Imagine",
          }));
          set((s) => {
            const gallery = [...created, ...s.gallery].slice(0, 48);
            persist(gallery);
            return {
              gallery,
              busy: false,
              busyLabel: "",
              selectedId: created[0]?.id ?? s.selectedId,
            };
          });
          toast.message("A gerar a imagem… aparece aqui em cima.");
          for (const item of created) {
            if (item.requestId) void pollUntilDone(item.id, item.requestId, set, get);
          }
          return;
        }
        const urls = result.urls ?? [];
        if (!urls.length) {
          set({ busy: false, busyLabel: "", error: "A geração não devolveu imagens." });
          toast.error("A geração não devolveu imagens.");
          return;
        }
        const created: GalleryItem[] = [];
        for (const url of urls) {
          const id = newId();
          const item: GalleryItem = {
            id,
            kind: "image",
            prompt,
            enhancedPrompt: finalPrompt,
            aspectRatio: String(format.aspect),
            resolution: state.imageResolution,
            url,
            remoteUrl: url.startsWith("http") ? url : undefined,
            createdAt: Date.now(),
            status: "done",
          };
          const blobUrl = await cacheRemoteMedia(id, url);
          if (blobUrl) item.url = blobUrl;
          created.push(item);
        }
        set((s) => {
          const gallery = [...created, ...s.gallery].slice(0, 48);
          persist(gallery);
          return {
            gallery,
            busy: false,
            busyLabel: "",
            selectedId: created[0]?.id ?? s.selectedId,
          };
        });
        toast.success(created.length > 1 ? `${created.length} imagens prontas.` : "Imagem pronta.");
        return;
      }

      set({
        busyLabel:
          state.action === "extend"
            ? "A estender o vídeo…"
            : state.action === "edit"
              ? "A editar o vídeo…"
              : startFrame
                ? "A animar a foto…"
                : "A gerar o vídeo…",
      });

      const started = await startImagineVideo({
        data: {
          prompt: finalPrompt,
          action: state.action,
          aspectRatio: format.aspect as VideoAspectRatio,
          resolution: state.videoResolution,
          duration,
          generateAudio: state.generateAudio,
          startFrame: startFrame?.url,
          lastFrame: lastFrame?.url,
          references: references.map((r) => r.url),
          sourceVideo: state.sourceVideo?.url,
        },
      });

      if (!started.ok) {
        const error = shownError(started.error);
        set({ busy: false, busyLabel: "", error });
        toast.error(error);
        return;
      }

      const id = newId();
      const pending: GalleryItem = {
        id,
        kind: "video",
        prompt,
        enhancedPrompt: finalPrompt,
        aspectRatio: String(format.aspect),
        resolution: state.videoResolution,
        duration,
        url: startFrame?.url || "",
        createdAt: Date.now(),
        status: "pending",
        progress: 1,
        requestId: started.requestId,
        provider: "grok",
        modelId: GROK_MODEL_ID,
        modelName: "Grok Imagine",
      };
      set((s) => {
        const gallery = [pending, ...s.gallery].slice(0, 48);
        persist(gallery);
        return { gallery, selectedId: id, busy: false, busyLabel: "" };
      });
      toast.message("A renderizar o vídeo… aparece aqui em cima quando estiver pronto.");
      void pollUntilDone(id, started.requestId, set, get);
    } catch (err) {
      const message = shownError(err instanceof Error ? err.message : "");
      set({ busy: false, busyLabel: "", error: message });
      toast.error(message);
    }
  },
}));

type GetState = () => StudioState;

async function runCatalog(
  state: StudioState,
  set: SetState,
  get: GetState,
) {
  if (state.catalogOfficial === false) {
    const ok = window.confirm(
      "Modelo da comunidade. O preço e o comportamento podem variar. Queres gerar na mesma?",
    );
    if (!ok) return;
  }
  set({ busy: true, busyLabel: "A enviar para o modelo…", error: null });
  try {
    const imageUrl = state.refs.find((ref) => ref.role === "start")?.url || state.refs[0]?.url;
    if (imageUrl && !imageUrl.startsWith("data:image/") && !imageUrl.startsWith("https://")) {
      const error = "O envio da foto falhou. Anexa a imagem outra vez.";
      set({ busy: false, busyLabel: "", error });
      toast.error(error);
      return;
    }
    const lastFrameUrl = state.refs.find((ref) => ref.role === "last")?.url;
    const started = await startCatalogGeneration({
      data: {
        modelId: state.catalogId,
        prompt: state.prompt.trim(),
        values: state.catalogValues,
        imageUrl,
        lastFrameUrl,
        videoUrl: state.sourceVideo?.url,
      },
    });
    if (!started.ok) {
      const error = shownError(started.error);
      set({ busy: false, busyLabel: "", error });
      toast.error(error);
      return;
    }
    const id = newId();
    const item: GalleryItem = {
      id,
      kind: started.kind,
      prompt: state.prompt.trim(),
      enhancedPrompt: state.prompt.trim(),
      aspectRatio: String(state.catalogValues.aspect_ratio || "auto"),
      resolution: String(state.catalogValues.resolution || state.catalogValues.megapixels || ""),
      url: "",
      createdAt: Date.now(),
      status: "pending",
      progress: 1,
      requestId: started.requestId,
      provider: "replicate",
      modelId: state.catalogId,
      modelName: state.catalogName,
    };
    set((s) => {
      const gallery = [item, ...s.gallery].slice(0, 48);
      persist(gallery);
      return { gallery, selectedId: id, busy: false, busyLabel: "" };
    });
    toast.message("A gerar… o resultado aparece em cima.");
    void pollUntilDone(id, started.requestId, set, get);
  } catch {
    set({ busy: false, busyLabel: "", error: "A geração falhou. Tenta outra vez." });
    toast.error("A geração falhou. Tenta outra vez.");
  }
}

async function pollUntilDone(id: string, requestId: string, set: SetState, get: GetState) {
  for (let i = 0; i < 240; i++) {
    await sleep(i === 0 ? 1200 : 2800);
    let result: Awaited<ReturnType<typeof pollImagineVideo>>;
    try {
      result = await pollImagineVideo({ data: { requestId } });
    } catch {
      continue;
    }
    if (!result.ok) {
      const error = shownError(result.error);
      set((s) => {
        const gallery = s.gallery.map((g) =>
          g.id === id ? { ...g, status: "failed" as const, error } : g,
        );
        persist(gallery);
        return { gallery };
      });
      toast.error(error);
      return;
    }
    if (result.status === "pending") {
      set((s) => {
        const gallery = s.gallery.map((g) =>
          g.id === id
            ? {
                ...g,
                progress: Math.min(92, Math.max(result.progress, 8 + i * 3)),
                status: "pending" as const,
              }
            : g,
        );
        persist(gallery);
        return { gallery };
      });
      continue;
    }
    if (result.status === "failed" || result.status === "expired") {
      const error = shownError(result.error || "A geração falhou.");
      set((s) => {
        const gallery = s.gallery.map((g) =>
          g.id === id ? { ...g, status: "failed" as const, error } : g,
        );
        persist(gallery);
        return { gallery };
      });
      toast.error(error);
      return;
    }
    if (result.status === "done" && result.url) {
      if (result.stage === "frame") {
        const item = get().gallery.find((g) => g.id === id);
        if (!item) return;
        set((s) => ({
          gallery: s.gallery.map((g) =>
            g.id === id
              ? { ...g, url: result.url!, remoteUrl: result.url, progress: 40, status: "pending" as const }
              : g,
          ),
        }));
        const started = await startImagineVideo({
          data: {
            prompt: item.enhancedPrompt || item.prompt,
            action: "generate",
            aspectRatio: (item.aspectRatio as VideoAspectRatio) || "16:9",
            resolution:
              item.resolution === "480p" || item.resolution === "1080p" || item.resolution === "720p"
                ? item.resolution
                : "720p",
            duration: item.duration || 6,
            startFrame: result.url,
            references: [],
          },
        });
        if (!started.ok) {
          const error = shownError(started.error);
          set((s) => {
            const gallery = s.gallery.map((g) =>
              g.id === id ? { ...g, status: "failed" as const, error } : g,
            );
            persist(gallery);
            return { gallery };
          });
          toast.error(error);
          return;
        }
        set((s) => ({
          gallery: s.gallery.map((g) =>
            g.id === id ? { ...g, requestId: started.requestId, progress: 45 } : g,
          ),
        }));
        void pollUntilDone(id, started.requestId, set, get);
        return;
      }
      const blobUrl = await cacheRemoteMedia(id, result.url);
      const kind = get().gallery.find((g) => g.id === id)?.kind;
      set((s) => {
        const gallery = s.gallery.map((g) =>
          g.id === id
            ? {
                ...g,
                status: "done" as const,
                progress: 100,
                url: blobUrl || result.url!,
                remoteUrl: result.url,
                duration: result.duration ?? g.duration,
                runtimeSeconds: result.runtimeSeconds ?? g.runtimeSeconds,
              }
            : g,
        );
        persist(gallery);
        return { gallery };
      });
      toast.success(kind === "image" ? "Imagem pronta." : "Vídeo pronto.");
      return;
    }
  }
  set((s) => {
    const gallery = s.gallery.map((g) =>
      g.id === id ? { ...g, status: "failed" as const, error: "A geração demorou demasiado." } : g,
    );
    persist(gallery);
    return { gallery };
  });
  toast.error("A geração demorou demasiado. Tenta de novo.");
}
