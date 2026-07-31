import type { BlockDescription, CachedModel } from "../lib/api";
import type { StepNodeData } from "../lib/workflow";

type Props = {
  selected: { id: string; data: StepNodeData } | null;
  block?: BlockDescription;
  models: CachedModel[];
  onChangeParams: (id: string, params: Record<string, unknown>) => void;
  status: string;
  runResult: string;
};

function isModelField(key: string): boolean {
  return key === "model_id" || key === "model" || key.endsWith("_model_id");
}

export function Inspector({
  selected,
  block,
  models,
  onChangeParams,
  status,
  runResult,
}: Props) {
  const schema = (block?.block_schema || {}) as {
    properties?: Record<
      string,
      { type?: string | string[]; enum?: unknown[]; description?: string; title?: string }
    >;
  };
  const props = schema.properties || {};

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--ig-border)] bg-[var(--ig-panel)]">
      <div className="border-b border-[var(--ig-border)] p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ig-muted)]">
          Inspector
        </div>
        <div className="mt-1 text-sm font-semibold">
          {selected ? selected.data.label : "No selection"}
        </div>
        {selected && (
          <div className="truncate text-[10px] text-[var(--ig-muted)]">{selected.id}</div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!selected && (
          <p className="text-sm text-[var(--ig-muted)]">
            Select a block on the canvas to edit parameters. Wire inputs with edges;
            complex kinds use JSON.
          </p>
        )}
        {selected &&
          Object.entries(props)
            .filter(([k]) => k !== "type" && k !== "name")
            .map(([key, prop]) => {
              const value = selected.data.params[key];
              const isSelector =
                typeof value === "string" &&
                (value.startsWith("$inputs.") || value.startsWith("$steps."));
              if (isSelector) {
                return (
                  <label key={key} className="mb-3 block text-xs">
                    <span className="text-[var(--ig-muted)]">{key} (wired)</span>
                    <div className="mt-1 truncate rounded bg-[var(--ig-bg)] px-2 py-1 font-mono text-[11px]">
                      {String(value)}
                    </div>
                  </label>
                );
              }
              if (isModelField(key) && models.length > 0) {
                return (
                  <label key={key} className="mb-3 block text-xs">
                    <span className="text-[var(--ig-muted)]">{prop.title || key}</span>
                    <select
                      className="mt-1 w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: e.target.value,
                        })
                      }
                    >
                      <option value="">Select model…</option>
                      {models.map((m) => (
                        <option key={m.model_id} value={m.model_id}>
                          {m.name || m.model_id}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (prop.enum) {
                return (
                  <label key={key} className="mb-3 block text-xs">
                    <span className="text-[var(--ig-muted)]">{prop.title || key}</span>
                    <select
                      className="mt-1 w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: e.target.value,
                        })
                      }
                    >
                      {prop.enum.map((opt) => (
                        <option key={String(opt)} value={String(opt)}>
                          {String(opt)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              const t = Array.isArray(prop.type) ? prop.type[0] : prop.type;
              if (t === "boolean") {
                return (
                  <label key={key} className="mb-3 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) =>
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: e.target.checked,
                        })
                      }
                    />
                    <span>{prop.title || key}</span>
                  </label>
                );
              }
              if (t === "number" || t === "integer") {
                return (
                  <label key={key} className="mb-3 block text-xs">
                    <span className="text-[var(--ig-muted)]">{prop.title || key}</span>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5"
                      value={value === undefined || value === null ? "" : Number(value)}
                      onChange={(e) =>
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                );
              }
              if (t === "string" || t === undefined) {
                return (
                  <label key={key} className="mb-3 block text-xs">
                    <span className="text-[var(--ig-muted)]">{prop.title || key}</span>
                    <input
                      className="mt-1 w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5"
                      value={value === undefined || value === null ? "" : String(value)}
                      onChange={(e) =>
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </label>
                );
              }
              // Complex kind — JSON fallback
              return (
                <label key={key} className="mb-3 block text-xs">
                  <span className="text-[var(--ig-muted)]">{prop.title || key} (JSON)</span>
                  <textarea
                    className="mt-1 h-20 w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5 font-mono text-[11px]"
                    value={
                      typeof value === "string"
                        ? value
                        : JSON.stringify(value ?? null, null, 2)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      try {
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: JSON.parse(raw),
                        });
                      } catch {
                        onChangeParams(selected.id, {
                          ...selected.data.params,
                          [key]: raw,
                        });
                      }
                    }}
                  />
                </label>
              );
            })}
      </div>
      <div className="border-t border-[var(--ig-border)] p-3">
        <div className="mb-1 text-xs font-semibold text-[var(--ig-muted)]">Status</div>
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--ig-bg)] p-2 text-[11px]">
          {status || "Idle"}
        </pre>
        {runResult && (
          <>
            <div className="mb-1 mt-2 text-xs font-semibold text-[var(--ig-muted)]">
              Last run
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--ig-bg)] p-2 text-[11px]">
              {runResult}
            </pre>
          </>
        )}
      </div>
    </aside>
  );
}
