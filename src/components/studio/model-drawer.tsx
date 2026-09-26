import { Loader2, Search, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GROK_MODEL_ID, type CatalogModel, type ModelField } from "@/lib/imagine/catalog";
import { searchImagineModels } from "@/lib/imagine/functions";
import { useStudio } from "@/lib/imagine/store";
import { cn } from "@/lib/cn";

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "image", label: "Imagem" },
  { id: "video", label: "Vídeo" },
  { id: "upscale", label: "Upscale" },
  { id: "lora", label: "LoRA" },
] as const;

export function ModelDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(false);
  const catalogId = useStudio((s) => s.catalogId);
  const setCatalogModel = useStudio((s) => s.setCatalogModel);
  const favorites = useStudio((s) => s.favorites);
  const toggleFavorite = useStudio((s) => s.toggleFavorite);
  const gallery = useStudio((s) => s.gallery);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void searchImagineModels({ data: { query } })
        .then((result) => {
          if (!cancel) setModels(result.models);
        })
        .catch(() => {
          if (!cancel) setModels([]);
        })
        .finally(() => {
          if (!cancel) setLoading(false);
        });
    }, 280);
    return () => {
      cancel = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  if (!open) return null;

  const shown = models.filter((model) => {
    if (model.id === GROK_MODEL_ID) return filter === "all" || filter === "image" || filter === "video";
    if (filter === "lora") return model.supportsLora;
    if (filter === "all") return true;
    return model.type === filter;
  });
  const favoriteModels = shown.filter((model) => favorites.includes(model.id));
  const rest = shown.filter((model) => !favorites.includes(model.id));
  const timed = gallery.filter((item) => typeof item.runtimeSeconds === "number");

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" role="dialog" aria-label="Modelos">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <p className="text-sm font-medium">Modelo</p>
        <button type="button" aria-label="Fechar" onClick={onClose} className="flex size-10 items-center justify-center">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-3">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3">
          <Search className="size-4 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar modelos"
            className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </label>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "h-9 shrink-0 rounded-full px-3 text-sm",
                filter === item.id ? "bg-accent text-accent-fg" : "bg-surface text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-subtle" />
          </div>
        )}
        {[...favoriteModels, ...rest].map((model) => (
          <article key={model.id} className="flex gap-3 rounded-2xl bg-surface p-3">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              {model.thumbnail ? (
                <img src={model.thumbnail} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-subtle">
                  {model.provider === "grok" ? "Grok" : model.owner.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">{model.displayName}</p>
                  <p className="truncate text-xs text-subtle">
                    {model.provider === "grok" ? "Predefinido" : model.owner}
                    {model.official === true ? " · Oficial" : ""}
                    {model.official === false ? " · Comunidade" : ""}
                  </p>
                </div>
                {model.id !== GROK_MODEL_ID && (
                  <button
                    type="button"
                    aria-label="Favorito"
                    onClick={() => toggleFavorite(model.id)}
                    className="flex size-8 shrink-0 items-center justify-center"
                  >
                    <Star className={cn("size-4", favorites.includes(model.id) ? "fill-fg text-fg" : "text-subtle")} />
                  </button>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{model.description}</p>
              <p className="mt-1 text-xs text-subtle">{model.pricingLabel}</p>
              {model.type === "upscale" || model.followsPrompt === false ? (
                <p className="text-xs text-muted">Só aumenta a nitidez. Não segue o prompt.</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void setCatalogModel(model.id);
                  onClose();
                }}
                className={cn(
                  "mt-2 h-9 rounded-full px-3 text-sm font-medium",
                  catalogId === model.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
                )}
              >
                {catalogId === model.id ? "Em uso" : "Usar modelo"}
              </button>
            </div>
          </article>
        ))}
        {!loading && shown.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Nenhum modelo com este filtro.</p>
        )}
      </div>
      <div className="shrink-0 border-t border-border px-4 py-3 text-xs leading-relaxed text-subtle">
        <p>{gallery.length} gerações neste aparelho.</p>
        <p>
          {timed.length
            ? `Último tempo de execução registado: ${timed[0]?.runtimeSeconds?.toFixed(1)}s.`
            : "Custo em dólares: a API não devolve o preço. Não inventamos um valor."}
        </p>
      </div>
    </div>
  );
}

export function CatalogFields() {
  const fields = useStudio((s) => s.catalogFields);
  const values = useStudio((s) => s.catalogValues);
  const setCatalogValue = useStudio((s) => s.setCatalogValue);
  const official = useStudio((s) => s.catalogOfficial);
  const name = useStudio((s) => s.catalogName);
  const setCatalogModel = useStudio((s) => s.setCatalogModel);
  const loraFields = fields.filter((field) => field.lora);
  const prominent = fields.filter((field) => field.prominent && !field.lora);
  const rest = fields.filter((field) => !field.prominent && !field.lora && field.kind !== "image" && field.kind !== "video");
  const mode = fields.some((field) => field.key === "duration")
    ? "video"
    : fields.some((field) => field.key === "scale" || field.key === "face_enhance")
      ? "upscale"
      : "image";

  return (
    <div className="mb-2 space-y-2 px-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium capitalize">{name}</p>
        <button type="button" onClick={() => void setCatalogModel(GROK_MODEL_ID)} className="text-xs text-muted">
          Voltar ao Grok
        </button>
      </div>
      {official === false && (
        <p className="text-xs text-muted">Comunidade: o preço pode variar. Confirma antes de gerar.</p>
      )}
      {mode === "video" && <p className="text-xs font-medium text-fg">Frame para vídeo</p>}
      {mode === "image" && <p className="text-xs font-medium text-fg">Criar imagem</p>}
      {mode === "upscale" && (
        <p className="text-xs text-muted">Só aumenta a nitidez. O texto não muda a foto.</p>
      )}
      {mode === "video" && fields.some((field) => field.kind === "image") && (
        <p className="text-xs text-muted">A foto de início entra no primeiro frame. A de fim, se existir, fecha o vídeo.</p>
      )}
      {mode === "video" && (
        <p className="text-xs text-subtle">Estender um vídeo já feito só existe no Grok.</p>
      )}
      {prominent.map((field) => (
        <Prominent key={field.key} field={field} value={values[field.key]} onChange={setCatalogValue} />
      ))}
      {(rest.length > 0 || loraFields.length > 0) && (
        <details className="rounded-xl bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-sm text-fg">Mais ajustes</summary>
          <div className="mt-2 space-y-2">
            {rest.map((field) => (
              <Field key={field.key} field={field} value={values[field.key]} onChange={setCatalogValue} />
            ))}
            {loraFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-fg">LoRA</p>
                {loraFields.map((field) => (
                  <Field key={field.key} field={field} value={values[field.key]} onChange={setCatalogValue} />
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function Prominent({
  field,
  value,
  onChange,
}: {
  field: ModelField;
  value: string | number | boolean | undefined;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  if (field.key === "duration" && (field.kind === "integer" || field.kind === "number")) {
    const min = field.minimum ?? 2;
    const max = field.maximum && field.maximum <= 30 ? field.maximum : 15;
    const current = Math.min(max, Math.max(min, Number(value) || Number(field.defaultValue) || 5));
    return (
      <label className="flex items-center gap-3 rounded-full bg-surface-2 px-3">
        <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-fg">{current}s</span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={current}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
          className="h-10 w-full"
          aria-label="Duração do vídeo"
        />
        <span className="shrink-0 text-xs tabular-nums text-subtle">
          {min}–{max}s
        </span>
      </label>
    );
  }
  if (field.kind === "boolean") {
    const on = value === true;
    return (
      <button
        type="button"
        onClick={() => onChange(field.key, !on)}
        className={cn("h-9 rounded-full px-3 text-sm", on ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}
      >
        {field.key === "generate_audio" ? (on ? "Áudio ligado" : "Áudio desligado") : field.label}
      </button>
    );
  }
  if (field.kind === "enum" && field.enumValues) {
    const current = String(value ?? field.defaultValue ?? field.enumValues[0]);
    const label =
      field.key === "aspect_ratio" ? "Formato" : field.key === "resolution" || field.key === "quality" ? "Qualidade" : field.label;
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        <span className="flex h-9 shrink-0 items-center text-xs text-subtle">{label}</span>
        {field.enumValues.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(field.key, field.numeric ? Number(item) : item)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3 text-sm",
              current === item ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    );
  }
  return <Field field={field} value={value} onChange={onChange} />;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ModelField;
  value: string | number | boolean | undefined;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  if (field.kind === "image" || field.kind === "video") {
    return (
      <p className="text-xs text-muted">
        {field.kind === "video" ? "Anexa um vídeo com o clipe." : "Anexa a foto com o clipe. Este modelo usa essa imagem."}
        {field.required ? " Obrigatório." : ""}
      </p>
    );
  }
  if (field.kind === "boolean") {
    return (
      <button
        type="button"
        onClick={() => onChange(field.key, value !== true)}
        className={cn(
          "h-9 rounded-full px-3 text-sm",
          value === true ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
        )}
      >
        {field.label}
      </button>
    );
  }
  if (field.kind === "enum" && field.enumValues) {
    return (
      <label className="block text-xs text-subtle">
        {field.label}
        <select
          value={String(value ?? field.defaultValue ?? field.enumValues[0])}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="mt-1 h-10 w-full rounded-xl bg-surface-2 px-2 text-sm text-fg"
        >
          {field.enumValues.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block text-xs text-subtle">
      {field.label}
      <input
        value={value === undefined ? "" : String(value)}
        inputMode={field.kind === "number" || field.kind === "integer" ? "decimal" : "text"}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="mt-1 h-10 w-full rounded-xl bg-surface-2 px-3 text-sm text-fg outline-none"
      />
    </label>
  );
}
