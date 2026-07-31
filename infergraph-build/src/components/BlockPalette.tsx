import type { BlockDescription } from "../lib/api";
import { airGappedUnavailable } from "../lib/workflow";

type Props = {
  blocks: BlockDescription[];
  filter: string;
  onFilter: (v: string) => void;
  onAdd: (block: BlockDescription) => void;
};

export function BlockPalette({ blocks, filter, onFilter, onAdd }: Props) {
  const q = filter.trim().toLowerCase();
  const filtered = blocks.filter((b) => {
    if (!q) return true;
    return (
      b.human_friendly_block_name.toLowerCase().includes(q) ||
      b.manifest_type_identifier.toLowerCase().includes(q) ||
      (b.block_schema as { block_type?: string })?.block_type
        ?.toLowerCase()
        .includes(q)
    );
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--ig-border)] bg-[var(--ig-panel)]">
      <div className="border-b border-[var(--ig-border)] p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ig-muted)]">
          Blocks
        </div>
        <input
          className="w-full rounded border border-[var(--ig-border)] bg-[var(--ig-bg)] px-2 py-1.5 text-sm outline-none focus:border-[var(--ig-accent)]"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map((b) => {
          const unavailable = airGappedUnavailable(b);
          return (
            <button
              key={b.manifest_type_identifier}
              type="button"
              disabled={unavailable}
              onClick={() => onAdd(b)}
              className="mb-1 w-full rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-[var(--ig-border)] hover:bg-[var(--ig-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              title={b.manifest_type_identifier}
            >
              <div className="font-medium">{b.human_friendly_block_name}</div>
              <div className="truncate text-[10px] text-[var(--ig-muted)]">
                {(b.block_schema as { block_type?: string })?.block_type || "block"}
                {unavailable ? " · 需外网" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
