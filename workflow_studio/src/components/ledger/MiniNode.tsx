/** Mini pill node for the read-only card thumbnail canvas (13 §2 ledger card). */

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";

export type MiniNodeData = { label: string };
export type MiniAppNode = Node<MiniNodeData, "mini">;

/** Gray-accent pill: fixed 22px height, width set per node in the mini graph. */
export const MiniNode = memo(function MiniNode({ data }: NodeProps<MiniAppNode>) {
  return (
    <div className="flex h-full w-full items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,.06)]">
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
      <span className="truncate text-[10px] leading-none text-gray-700" title={data.label}>
        {data.label}
      </span>
    </div>
  );
});
