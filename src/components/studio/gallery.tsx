import {
  Clapperboard,
  Download,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { EXAMPLE_PROMPTS } from "@/lib/imagine/constants";
import { displaySrc } from "@/lib/imagine/media";
import { useStudio } from "@/lib/imagine/store";
import type { GalleryItem } from "@/lib/imagine/types";

function MediaThumb({ item }: { item: GalleryItem }) {
  const src = displaySrc(item.url || item.remoteUrl || "");
  const pending = item.status === "pending";
  const failed = item.status === "failed";

  return (
    <div className="relative size-full overflow-hidden bg-surface-2">
      {item.kind === "video" && src && !pending ? (
        <video src={src} muted playsInline className="size-full object-cover" />
      ) : src && !pending && !failed ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          {failed ? (
            <span className="px-1 text-center text-[10px] font-medium text-danger">Falhou</span>
          ) : item.kind === "video" ? (
            <Clapperboard className="size-4 text-subtle" />
          ) : (
            <ImageIcon className="size-4 text-subtle" />
          )}
        </div>
      )}
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/50">
          <Loader2 className="size-4 animate-spin text-fg" />
        </div>
      )}
    </div>
  );
}

function Stage({ item }: { item: GalleryItem }) {
  const src = displaySrc(item.url || item.remoteUrl || "");
  const pending = item.status === "pending";
  const failed = item.status === "failed";
  const ready = !pending && !failed && Boolean(src);

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center">
      {pending && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-fg" />
          <p className="text-sm tabular-nums text-muted">A gerar… {Math.round(item.progress ?? 0)}%</p>
        </div>
      )}
      {failed && (
        <p className="max-w-xs px-6 text-center text-sm leading-relaxed text-danger">
          {item.error && item.error.length < 160 && !/token|E00|unexpected|code/i.test(item.error)
            ? item.error
            : "A geração falhou. Tenta de novo."}
        </p>
      )}
      {ready && item.kind === "video" && (
        <video
          src={src}
          muted
          playsInline
          loop
          autoPlay
          controls
          className="max-h-full max-w-full rounded-2xl bg-black"
        />
      )}
      {ready && item.kind !== "video" && (
        <img src={src} alt={item.prompt} className="max-h-full max-w-full rounded-2xl object-contain" />
      )}
    </div>
  );
}

export function Gallery() {
  const gallery = useStudio((s) => s.gallery);
  const selectedId = useStudio((s) => s.selectedId);
  const hydrated = useStudio((s) => s.hydrated);
  const setSelectedId = useStudio((s) => s.setSelectedId);
  const fillExample = useStudio((s) => s.fillExample);
  const kind = useStudio((s) => s.kind);
  const downloadItem = useStudio((s) => s.downloadItem);
  const [fullscreen, setFullscreen] = useState(false);

  const viewing = gallery.find((item) => item.id === selectedId) ?? gallery[0];

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-subtle" />
      </div>
    );
  }

  if (gallery.length === 0 || !viewing) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          O resultado aparece aqui. Escreve o prompt e toca em Gerar.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.filter((e) => e.kind === kind).map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => fillExample(example.label)}
              className="h-10 rounded-full bg-surface px-4 text-sm text-muted hover:text-fg"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const ready = viewing.status !== "pending" && viewing.status !== "failed";

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 px-3 py-2">
          <Stage item={viewing} />
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 px-4 pb-2">
          <Button
            type="button"
            size="sm"
            disabled={!ready}
            onClick={() => downloadItem(viewing)}
          >
            <Download className="size-4" />
            Descarregar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!ready}
            onClick={() => setFullscreen(true)}
          >
            Ecrã inteiro
          </Button>
        </div>

        {gallery.length > 1 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin">
            {gallery.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "h-16 w-12 shrink-0 overflow-hidden rounded-lg",
                  item.id === viewing.id ? "ring-2 ring-fg" : "opacity-70",
                )}
              >
                <MediaThumb item={item} />
              </button>
            ))}
          </div>
        )}
      </div>
      {fullscreen && <Lightbox item={viewing} onClose={() => setFullscreen(false)} />}
    </>
  );
}

function Lightbox({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const downloadItem = useStudio((s) => s.downloadItem);
  const deleteItem = useStudio((s) => s.deleteItem);
  const useAsStartFrame = useStudio((s) => s.useAsStartFrame);
  const useAsReference = useStudio((s) => s.useAsReference);
  const useToExtend = useStudio((s) => s.useToExtend);
  const useToEdit = useStudio((s) => s.useToEdit);

  const src = displaySrc(item.url || item.remoteUrl || "");
  const pending = item.status === "pending";
  const ready = item.status !== "pending" && item.status !== "failed" && Boolean(src);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pré-visualização"
      className="fixed inset-0 z-40 flex flex-col bg-bg/92"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4 sm:px-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm text-muted">
            {item.modelName || (item.kind === "video" ? "Vídeo" : "Imagem")}
            {item.duration ? ` · ${item.duration}s` : ""} · {item.aspectRatio} · {item.resolution}
            {typeof item.runtimeSeconds === "number" ? ` · ${item.runtimeSeconds.toFixed(1)}s` : ""}
          </p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          {pending ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-fg" />
              <p className="text-sm tabular-nums text-muted">{Math.round(item.progress ?? 0)}%</p>
            </div>
          ) : item.kind === "video" && src ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="max-h-[min(70dvh,720px)] max-w-full rounded-lg outline outline-1 -outline-offset-1 outline-fg/10"
            />
          ) : src ? (
            <img
              src={src}
              alt={item.prompt}
              className="max-h-[min(70dvh,720px)] max-w-full rounded-lg object-contain outline outline-1 -outline-offset-1 outline-fg/10"
            />
          ) : (
            <p className="text-sm text-danger">{item.error || "Sem média"}</p>
          )}
        </div>

        <div className="mx-auto w-full max-w-2xl space-y-3 pb-[env(safe-area-inset-bottom)]">
          <p className="text-sm leading-relaxed text-fg">{item.prompt}</p>
          {item.enhancedPrompt && item.enhancedPrompt !== item.prompt && (
            <p className="text-xs leading-relaxed text-muted">Enviado: {item.enhancedPrompt}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!ready} onClick={() => downloadItem(item)}>
              <Download className="size-4" />
              Descarregar
            </Button>
            {item.kind === "image" && ready && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => useAsStartFrame(item)}>
                  <Sparkles className="size-4" />
                  Animar
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => useAsReference(item)}>
                  Usar como referência
                </Button>
              </>
            )}
            {item.kind === "video" && ready && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => useToExtend(item)}>
                  Estender
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => useToEdit(item)}>
                  Editar
                </Button>
              </>
            )}
            <Button type="button" size="sm" variant="danger" onClick={() => void deleteItem(item.id)}>
              <Trash2 className="size-4" />
              Apagar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
