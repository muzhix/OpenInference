type Props = {
  workflowId: string;
  onWorkflowId: (id: string) => void;
  onSave: () => void;
  onValidate: () => void;
  onRun: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  busy: boolean;
};

export function Toolbar({
  workflowId,
  onWorkflowId,
  onSave,
  onValidate,
  onRun,
  onExport,
  onImport,
  busy,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--ig-border)] bg-[var(--ig-panel)] px-3">
      <div className="mr-2 text-sm font-bold tracking-tight">
        InferGraph <span className="text-[var(--ig-accent)]">Build</span>
      </div>
      <input
        className="w-40 rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1 text-sm"
        value={workflowId}
        onChange={(e) => onWorkflowId(e.target.value.replace(/[^\w\-]/g, "_"))}
        title="Workflow id"
      />
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded bg-[var(--ig-accent)] px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onValidate}
        className="rounded border border-[var(--ig-border)] px-3 py-1 text-sm hover:bg-[var(--ig-bg)] disabled:opacity-50"
      >
        Validate
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRun}
        className="rounded border border-[var(--ig-border)] px-3 py-1 text-sm hover:bg-[var(--ig-bg)] disabled:opacity-50"
      >
        Run
      </button>
      <button
        type="button"
        onClick={onExport}
        className="rounded border border-[var(--ig-border)] px-3 py-1 text-sm hover:bg-[var(--ig-bg)]"
      >
        Export
      </button>
      <label className="cursor-pointer rounded border border-[var(--ig-border)] px-3 py-1 text-sm hover:bg-[var(--ig-bg)]">
        Import
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </label>
      <div className="ml-auto text-[11px] text-[var(--ig-muted)]">offline-first · local API</div>
    </header>
  );
}
