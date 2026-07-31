import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StepNodeData } from "../lib/workflow";

export function BlockNode({ data, selected }: NodeProps) {
  const d = data as StepNodeData;
  return (
    <div
      className={`min-w-[180px] rounded-md border px-3 py-2 shadow-sm ${
        selected ? "border-[var(--ig-accent)]" : "border-[var(--ig-border)]"
      } ${d.airGappedUnavailable ? "opacity-60" : ""}`}
      style={{ background: "var(--ig-panel)" }}
    >
      <Handle type="target" position={Position.Left} id="image" className="!bg-[var(--ig-accent)]" />
      <div className="font-semibold text-[13px]">{d.label}</div>
      <div className="mt-0.5 truncate text-[10px] text-[var(--ig-muted)]">{d.blockType}</div>
      {d.airGappedUnavailable && (
        <div className="mt-1 text-[10px] text-[var(--ig-danger)]">需外网</div>
      )}
      <div className="mt-2 flex flex-col gap-1">
        {(d.outputs.length ? d.outputs : ["out"]).map((out) => (
          <div key={out} className="relative pr-2 text-right text-[10px] text-[var(--ig-muted)]">
            {out}
            <Handle
              type="source"
              position={Position.Right}
              id={out}
              className="!bg-[var(--ig-ok)]"
              style={{ top: "auto", bottom: 4 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
