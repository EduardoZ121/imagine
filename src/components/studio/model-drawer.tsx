import { Loader2, Search, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GROK_MODEL_ID, type CatalogModel, type ModelField } from "@/lib/imagine/catalog";
import { HF_MODELS } from "@/lib/imagine/hf";
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

const HF_PRIORITY = new Map(
  [
    "hf:black-forest-labs/FLUX.2-klein-4B-dedicated",
    "hf:Qwen/Qwen-Image-Edit",
    "hf:black-forest-labs/FLUX.1-Kontext-dev",
    "hf:black-forest-labs/FLUX.2-klein-9B",
    "hf:fancyfeast/big-asp-v2",
    "hf:TheImposterImposters/LUSTIFY-v2.0",
  ].map((id, index) => [id, index]),
);

function capabilityLabel(model: CatalogModel): string {
  if (model.provider === "huggingface") {
    const task = HF_MODELS.find((item) => item.id === model.id)?.task;
    if (task === "image-to-image") return "Foto → imagem";
    if (task === "image-to-video") return "Foto → vídeo";
    if (task === "text-to-video") return "Texto → vídeo";
    return "Texto → imagem";
  }
  if (model.type === "video") return "Vídeo";
  if (model.type === "upscale") return "Upscale";
  return "Imagem";
}

export function ModelDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [source, setSource] = useState<"replicate" | "huggingface">("replicate");
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
    if (!open || source !== "replicate") return;
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
  }, [open, query, source]);

  if (!open) return null;

  const catalog =
    source === "huggingface"
      ? [...HF_MODELS].sort((a, b) => (HF_PRIORITY.get(a.id) ?? 99) - (HF_PRIORITY.get(b.id) ?? 99))
      : models;
  const shown = catalog.filter((model) => {
    if (source === "huggingface") {
      const blob = `${model.displayName} ${model.description}`.toLowerCase();
      if (query && !blob.includes(query.toLowerCase())) return false;
      if (filter === "lora" || filter === "upscale") return false;
      if (filter === "all") return true;
      return model.type === filter;
    }
    if (model.id === GROK_MODEL_ID)
      return filter === "all" || filter === "image" || filter === "video";
    if (filter === "lora") return model.supportsLora;
    if (filter === "all") return true;
    return model.type === filter;
  });
  const favoriteModels = shown.filter((model) => favorites.includes(model.id));
  const rest = shown.filter((model) => !favorites.includes(model.id));
  const timed = gallery.filter((item) => typeof item.runtimeSeconds === "number");

  return (
    <div className="fixed inset-0 z-40 bg-black/70 sm:p-3" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full flex-col bg-bg shadow-2xl sm:max-w-xl sm:rounded-2xl sm:ring-1 sm:ring-border"
        role="dialog"
        aria-modal="true"
        aria-label="Modelos"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div>
            <p className="text-sm font-semibold">Escolher modelo</p>
            <p className="text-xs text-subtle">Confirma o tipo de entrada antes de gerar.</p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-3">
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
            <button
              type="button"
              onClick={() => setSource("replicate")}
              className={cn(
                "h-9 rounded-full text-sm font-medium",
                source === "replicate" ? "bg-accent text-accent-fg" : "text-muted",
              )}
            >
              Replicate
            </button>
            <button
              type="button"
              onClick={() => setSource("huggingface")}
              className={cn(
                "h-9 rounded-full text-sm font-medium",
                source === "huggingface" ? "bg-accent text-accent-fg" : "text-muted",
              )}
            >
              Hugging Face
            </button>
          </div>
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
                aria-pressed={filter === item.id}
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
          {source === "huggingface" && (
            <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
              Modelos 18+ aceitam apenas adultos e conteúdo consensual. Modelos de texto não usam a
              foto anexada. Para alterações que precisam de seguir o pedido, começa no FLUX.2 Klein
              Dedicado, Qwen Edit ou Kontext.
            </p>
          )}
          {loading && source === "replicate" && (
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
                    {model.provider === "grok"
                      ? "Grok"
                      : model.provider === "huggingface"
                        ? "HF"
                        : model.owner.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize">{model.displayName}</p>
                    <p className="truncate text-xs text-subtle">
                      {model.provider === "grok"
                        ? "Predefinido"
                        : model.provider === "huggingface"
                          ? "Hugging Face"
                          : model.owner}
                      {model.official === true ? " · Oficial" : ""}
                      {model.official === false ? " · Comunidade" : ""}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                      {capabilityLabel(model)}
                      {model.tags.includes("18+") ? " · 18+" : ""}
                    </p>
                  </div>
                  {model.id !== GROK_MODEL_ID && (
                    <button
                      type="button"
                      aria-label="Favorito"
                      onClick={() => toggleFavorite(model.id)}
                      className="flex size-8 shrink-0 items-center justify-center"
                    >
                      <Star
                        className={cn(
                          "size-4",
                          favorites.includes(model.id) ? "fill-fg text-fg" : "text-subtle",
                        )}
                      />
                    </button>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {model.description}
                </p>
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
        <div className="shrink-0 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs leading-relaxed text-subtle">
          <p>{gallery.length} gerações neste aparelho.</p>
          <p>
            {timed.length
              ? `Último tempo de execução registado: ${timed[0]?.runtimeSeconds?.toFixed(1)}s.`
              : "Custo em dólares: a API não devolve o preço. Não inventamos um valor."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CatalogFields() {
  const fields = useStudio((s) => s.catalogFields);
  const values = useStudio((s) => s.catalogValues);
  const setCatalogValue = useStudio((s) => s.setCatalogValue);
  const official = useStudio((s) => s.catalogOfficial);
  const setCatalogModel = useStudio((s) => s.setCatalogModel);
  const [open, setOpen] = useState<string | null>(null);
  const loraFields = fields.filter((field) => field.lora);
  const prominent = fields.filter((field) => field.prominent && !field.lora);
  const rest = fields.filter(
    (field) => !field.prominent && !field.lora && field.kind !== "image" && field.kind !== "video",
  );
  const upscale = fields.some((field) => field.key === "scale" || field.key === "face_enhance");
  const opened = prominent.find((field) => field.key === open);

  return (
    <div className="relative mt-1">
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[42dvh] overflow-y-auto rounded-xl bg-surface-2 p-2 shadow-[0_0_0_1px_rgb(244_244_245/0.12),0_16px_40px_rgb(0_0_0/0.45)]">
          {opened && (
            <FieldChoices
              field={opened}
              value={values[opened.key]}
              onChange={(key, value) => {
                setCatalogValue(key, value);
                if (opened.kind === "enum" || opened.key === "duration") setOpen(null);
              }}
            />
          )}
          {open === "more" && (
            <div className="space-y-2">
              {rest.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={setCatalogValue}
                />
              ))}
              {loraFields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={setCatalogValue}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {prominent.map((field) => (
          <button
            key={field.key}
            type="button"
            onClick={() => setOpen(open === field.key ? null : field.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
              open === field.key ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            {fieldValueLabel(field, values[field.key])}
          </button>
        ))}
        {(rest.length > 0 || loraFields.length > 0) && (
          <button
            type="button"
            onClick={() => setOpen(open === "more" ? null : "more")}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-medium",
              open === "more" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            Mais
          </button>
        )}
        <button
          type="button"
          onClick={() => void setCatalogModel(GROK_MODEL_ID)}
          className="inline-flex h-8 items-center rounded-full px-2.5 text-xs text-subtle"
        >
          Grok
        </button>
      </div>
      {upscale && <p className="mt-1 px-1 text-[11px] text-subtle">Só aumenta a nitidez.</p>}
      {official === false && (
        <p className="mt-1 px-1 text-[11px] text-subtle">Modelo da comunidade.</p>
      )}
    </div>
  );
}

function fieldValueLabel(field: ModelField, value: string | number | boolean | undefined) {
  if (field.key === "duration") return `${Number(value) || field.defaultValue || 5}s`;
  if (field.kind === "boolean") {
    const on = value === true;
    if (field.key === "generate_audio") return on ? "Áudio" : "Sem áudio";
    if (field.key === "keep_face") return on ? "Manter rosto" : "Rosto livre";
    if (field.key === "keep_body") return on ? "Manter corpo" : "Corpo livre";
    if (field.key === "keep_clothes") return on ? "Manter roupa" : "Roupa livre";
    return field.label;
  }
  const names: Record<string, string> = {
    aspect_ratio: "Formato",
    quality: "Qualidade",
    steps: "Passos",
    guidance: "Texto",
    strength: "Mudança",
    resolution: "Resolução",
    output_quality: "Qualidade",
    output_format: "Ficheiro",
  };
  const current = value === undefined || value === "" ? field.defaultValue : value;
  const prefix = names[field.key];
  return prefix ? `${prefix} ${current ?? ""}` : `${field.label} ${current ?? ""}`;
}

function FieldChoices({
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
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(field.key, n)}
            className={cn(
              "h-9 rounded-lg text-sm font-medium",
              current === n ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
            )}
          >
            {n}s
          </button>
        ))}
      </div>
    );
  }
  if (field.kind === "boolean") {
    const on = value === true;
    return (
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onChange(field.key, true)}
          className={cn(
            "h-9 rounded-lg text-sm",
            on ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
          )}
        >
          Ligado
        </button>
        <button
          type="button"
          onClick={() => onChange(field.key, false)}
          className={cn(
            "h-9 rounded-lg text-sm",
            !on ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
          )}
        >
          Desligado
        </button>
      </div>
    );
  }
  if (field.kind === "enum" && field.enumValues) {
    const current = String(value ?? field.defaultValue ?? field.enumValues[0]);
    return (
      <div className="flex flex-wrap gap-1">
        {field.enumValues.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(field.key, field.numeric ? Number(item) : item)}
            className={cn(
              "h-9 rounded-lg px-3 text-sm",
              current === item ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
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
        {field.kind === "video"
          ? "Anexa um vídeo com o clipe."
          : "Anexa a foto com o clipe. Este modelo usa essa imagem."}
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
