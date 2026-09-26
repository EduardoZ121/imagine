import { useEffect, useState } from "react";
import { Composer } from "@/components/studio/composer";
import { Gallery } from "@/components/studio/gallery";
import { ModelDrawer } from "@/components/studio/model-drawer";
import { useStudio } from "@/lib/imagine/store";

export function Studio() {
  const hydrate = useStudio((s) => s.hydrate);
  const dragging = useStudio((s) => s.dragging);
  const setDragging = useStudio((s) => s.setDragging);
  const addFiles = useStudio((s) => s.addFiles);
  const available = useStudio((s) => s.available);
  const catalogName = useStudio((s) => s.catalogName);
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
      }}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
        <span className="font-display text-lg italic tracking-tight">Imagine</span>
        <button
          type="button"
          onClick={() => setModelsOpen(true)}
          className="max-w-[62%] truncate rounded-full bg-surface px-3 py-1.5 text-sm text-fg"
        >
          {catalogName}
        </button>
        {available === false && (
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
            IA indisponível
          </span>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Gallery />
      </main>

      <Composer />
      <ModelDrawer open={modelsOpen} onClose={() => setModelsOpen(false)} />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-bg/70">
          <p className="rounded-2xl border border-border-strong bg-surface px-6 py-4 text-sm text-fg">
            Larga fotos ou um MP4 para usar como referência
          </p>
        </div>
      )}
    </div>
  );
}
