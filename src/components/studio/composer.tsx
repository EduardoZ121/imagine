import {
  ChevronsUpDown,
  Clapperboard,
  ImageIcon,
  Loader2,
  Paperclip,
  Sparkles,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  EXTEND_DURATION_MAX,
  EXTEND_DURATION_MIN,
  formatsFor,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  MAX_PROMPT,
  PROMPT_PLACEHOLDERS,
  resolveFormat,
  VIDEO_DURATION_MAX,
  VIDEO_DURATION_MIN,
  VIDEO_RESOLUTIONS,
} from "@/lib/imagine/constants";
import { isGrokModel } from "@/lib/imagine/catalog";
import { displaySrc } from "@/lib/imagine/media";
import { useStudio } from "@/lib/imagine/store";
import { CatalogFields } from "@/components/studio/model-drawer";
import type { RefRole } from "@/lib/imagine/types";

function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,color,opacity] duration-[var(--motion-quick)] ease-[var(--ease-out)] disabled:opacity-40",
        active
          ? "bg-accent text-accent-fg"
          : "bg-surface-2 text-muted hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

function AspectGlyph({ ratio }: { ratio: string }) {
  if (ratio === "auto") {
    return <span className="size-3 rounded-full border border-current" />;
  }
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return null;
  const max = 14;
  const scale = max / Math.max(w, h);
  return (
    <span
      className="inline-block rounded-[2px] border border-current"
      style={{ width: Math.max(7, w * scale), height: Math.max(7, h * scale) }}
    />
  );
}

function roleLabel(role: RefRole) {
  if (role === "start") return "Início";
  if (role === "last") return "Fim";
  return "Ref";
}

export function Composer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);
  const [formatOpen, setFormatOpen] = useState(false);

  const kind = useStudio((s) => s.kind);
  const action = useStudio((s) => s.action);
  const prompt = useStudio((s) => s.prompt);
  const formatId = useStudio((s) => s.formatId);
  const duration = useStudio((s) => s.duration);
  const extendDuration = useStudio((s) => s.extendDuration);
  const imageResolution = useStudio((s) => s.imageResolution);
  const videoResolution = useStudio((s) => s.videoResolution);
  const quality = useStudio((s) => s.quality);
  const imageCount = useStudio((s) => s.imageCount);
  const generateAudio = useStudio((s) => s.generateAudio);
  const enhance = useStudio((s) => s.enhance);
  const refs = useStudio((s) => s.refs);
  const sourceVideo = useStudio((s) => s.sourceVideo);
  const busy = useStudio((s) => s.busy);
  const busyLabel = useStudio((s) => s.busyLabel);
  const error = useStudio((s) => s.error);
  const catalogId = useStudio((s) => s.catalogId);
  const catalogFields = useStudio((s) => s.catalogFields);
  const grok = isGrokModel(catalogId);

  const setKind = useStudio((s) => s.setKind);
  const setAction = useStudio((s) => s.setAction);
  const setPrompt = useStudio((s) => s.setPrompt);
  const setFormatId = useStudio((s) => s.setFormatId);
  const setDuration = useStudio((s) => s.setDuration);
  const setExtendDuration = useStudio((s) => s.setExtendDuration);
  const setImageResolution = useStudio((s) => s.setImageResolution);
  const setVideoResolution = useStudio((s) => s.setVideoResolution);
  const setQuality = useStudio((s) => s.setQuality);
  const setImageCount = useStudio((s) => s.setImageCount);
  const setGenerateAudio = useStudio((s) => s.setGenerateAudio);
  const setEnhance = useStudio((s) => s.setEnhance);
  const addFiles = useStudio((s) => s.addFiles);
  const removeRef = useStudio((s) => s.removeRef);
  const setRefRole = useStudio((s) => s.setRefRole);
  const clearSourceVideo = useStudio((s) => s.clearSourceVideo);
  const generate = useStudio((s) => s.generate);

  const formats = useMemo(() => formatsFor(kind), [kind]);
  const format = resolveFormat(formatId, kind);
  const isVideo = kind === "video";
  const isExtend = isVideo && action === "extend";
  const isEdit = isVideo && action === "edit";
  const inheritFormat = isExtend || isEdit;
  const hasRefs = refs.length > 0 || Boolean(sourceVideo);
  const lock1080 = isVideo && refs.some((r) => r.role === "ref" || r.role === "last");

  const cta = !grok
    ? isVideo
      ? "Gerar vídeo"
      : "Gerar imagem"
    : isExtend
      ? "Estender vídeo"
      : isEdit
        ? "Editar vídeo"
        : isVideo
          ? "Gerar vídeo"
          : hasRefs
            ? "Editar imagem"
            : "Gerar imagem";

  const durationValue = isExtend ? extendDuration : duration;
  const setDurationValue = isExtend ? setExtendDuration : setDuration;
  const durationMin = isExtend ? EXTEND_DURATION_MIN : VIDEO_DURATION_MIN;
  const durationMax = isExtend ? EXTEND_DURATION_MAX : VIDEO_DURATION_MAX;

  useEffect(() => {
    if (!formatOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!formatRef.current?.contains(e.target as Node)) setFormatOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [formatOpen]);

  useEffect(() => {
    setFormatOpen(false);
  }, [kind]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="imagine-dock relative flex min-h-0 flex-1 flex-col rounded-2xl bg-surface p-2" ref={formatRef}>
        <div className="min-h-0 flex-1 overflow-y-auto">
        {(refs.length > 0 || sourceVideo) && (
          <div className="mb-2 flex gap-2 overflow-x-auto px-1 pt-1 scrollbar-thin">
            {sourceVideo && (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                <video src={displaySrc(sourceVideo.url)} muted className="size-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-medium uppercase tracking-wide text-fg">
                  {action === "edit" ? "Editar" : "Estender"}
                </span>
                <button
                  type="button"
                  aria-label="Remover vídeo"
                  onClick={clearSourceVideo}
                  className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-surface text-fg"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {refs.map((ref) => (
              <div key={ref.id} className="relative h-14 w-14 shrink-0">
                <img
                  src={displaySrc(ref.url)}
                  alt={ref.name || "referência"}
                  className="size-full rounded-lg object-cover"
                />
                {isVideo ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next: RefRole =
                        ref.role === "start" ? "ref" : ref.role === "ref" ? "last" : "start";
                      setRefRole(ref.id, next);
                    }}
                    className="absolute bottom-1 left-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-medium uppercase tracking-wide text-fg"
                  >
                    {roleLabel(ref.role)}
                  </button>
                ) : (
                  <span className="absolute bottom-1 left-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-medium uppercase tracking-wide text-fg">
                    Ref
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Remover referência"
                  onClick={() => removeRef(ref.id)}
                  className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-surface text-fg"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isVideo && sourceVideo && (
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
            <Chip active={action === "extend"} onClick={() => setAction("extend")}>
              Estender
            </Chip>
            <Chip active={action === "edit"} onClick={() => setAction("edit")}>
              Editar
            </Chip>
          </div>
        )}

        <div className="flex items-end gap-1 px-1">
          <button
            type="button"
            aria-label="Adicionar fotos ou vídeo de referência"
            onClick={() => fileRef.current?.click()}
            className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip className="size-5" />
          </button>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
            placeholder={
              !grok && catalogFields.some((field) => field.key === "duration")
                ? "Descreve o movimento…"
                : !grok && catalogFields.some((field) => field.kind === "image")
                  ? "O que queres mudar na foto…"
                  : !grok
                    ? "Descreve a imagem…"
                    : isExtend
                      ? "O que acontece a seguir…"
                      : isEdit
                        ? "O que queres mudar neste vídeo…"
                        : PROMPT_PLACEHOLDERS[kind]
            }
            rows={2}
            className="max-h-24 min-h-12 flex-1 resize-none bg-transparent py-2 text-base leading-snug text-fg placeholder:text-subtle focus:outline-none"
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {grok ? null : <CatalogFields />}

        {grok && (
        <>
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          <Chip active={!isVideo} onClick={() => setKind("image")}>
            <ImageIcon className="size-4" />
            Imagem
          </Chip>
          <Chip active={isVideo} onClick={() => setKind("video")}>
            <Clapperboard className="size-4" />
            Vídeo
          </Chip>
        </div>

        <div className="relative mt-2">
          <div className="flex gap-1.5 overflow-x-auto px-0.5 pb-1 scrollbar-thin">
          {!inheritFormat && (
            <Chip active={formatOpen} onClick={() => setFormatOpen((v) => !v)}>
              <AspectGlyph ratio={format.hint} />
              {format.label}
              <ChevronsUpDown className="size-3.5 opacity-70" />
            </Chip>
          )}

          {inheritFormat && (
            <span className="flex h-10 items-center px-2 text-xs text-subtle">Formato original</span>
          )}

          {!isVideo &&
            IMAGE_RESOLUTIONS.map((item) => (
              <Chip
                key={item.id}
                active={imageResolution === item.id}
                onClick={() => setImageResolution(item.id)}
              >
                {item.label}
              </Chip>
            ))}

          {!isVideo &&
            IMAGE_QUALITIES.map((item) => (
              <Chip key={item.id} active={quality === item.id} onClick={() => setQuality(item.id)}>
                {item.label}
              </Chip>
            ))}

          {!isVideo &&
            [1, 2, 4].map((n) => (
              <Chip key={n} active={imageCount === n} onClick={() => setImageCount(n)}>
                {n}×
              </Chip>
            ))}

          {isVideo &&
            !inheritFormat &&
            VIDEO_RESOLUTIONS.map((item) => (
              <Chip
                key={item.id}
                active={videoResolution === item.id}
                disabled={item.id === "1080p" && lock1080}
                title={
                  item.id === "1080p" && lock1080
                    ? "1080p só em texto ou um fotograma inicial"
                    : undefined
                }
                onClick={() => setVideoResolution(item.id)}
              >
                {item.label}
              </Chip>
            ))}

          {isVideo && !inheritFormat && (
            <Chip active={generateAudio} onClick={() => setGenerateAudio(!generateAudio)}>
              {generateAudio ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              Áudio
            </Chip>
          )}

          <Chip active={enhance} onClick={() => setEnhance(!enhance)} title="Interpreta o prompt antes de gerar">
            <Wand2 className="size-4" />
            Interpretar
          </Chip>
          </div>
        </div>

        {isVideo && !isEdit && (
          <label className="mx-0.5 mb-1 flex items-center gap-3 rounded-full bg-surface-2 px-3">
            <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-fg">{durationValue}s</span>
            <input
              type="range"
              min={durationMin}
              max={durationMax}
              step={1}
              value={durationValue}
              onChange={(e) => setDurationValue(Number(e.target.value))}
              className="h-10 w-full"
              aria-label={isExtend ? "Duração da extensão" : "Duração do vídeo"}
            />
            <span className="shrink-0 text-xs tabular-nums text-subtle">
              {durationMin}–{durationMax}s
            </span>
          </label>
        )}
        </>
        )}

        {error && (
          <p className="mx-0.5 mb-1 rounded-xl bg-danger/15 px-3 py-2 text-sm leading-snug text-danger">
            {error}
          </p>
        )}
        </div>

        {formatOpen && !inheritFormat && (
          <div className="absolute bottom-[4.5rem] left-3 z-20 w-[min(calc(100vw-2rem),18rem)] overflow-hidden rounded-xl bg-surface-2 p-1 shadow-[0_0_0_1px_rgb(244_244_245/0.12),0_16px_40px_rgb(0_0_0/0.45)]">
            {formats.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFormatId(item.id);
                  setFormatOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                  formatId === item.id ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
              >
                <AspectGlyph ratio={item.hint} />
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="tabular-nums text-subtle">{item.hint}</span>
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={() => void generate()}
          className="mt-1 h-12 w-full rounded-xl text-base font-semibold"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {busy ? busyLabel || "A gerar…" : cta}
        </Button>

        <p className="px-2 pt-1.5 text-right text-[11px] tabular-nums text-subtle">
          {prompt.length}/{MAX_PROMPT}
        </p>
      </div>
    </div>
  );
}
