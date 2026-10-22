/** Inputs node ($inputs): declared workflow inputs, ONE bottom source handle. */

import type { NodeProps } from "@xyflow/react";

import type { AppNode } from "../../../adapter";
import { useEditorStore } from "../../../state/editorStore";
import { NodeShell, BottomSourceHandle, IO_ACCENT } from "./shared";

export function WorkflowInputNode(props: NodeProps<AppNode>) {
  const { id, data, selected } = props;
  const expanded = useEditorStore((state) => state.expandedNodeId === id);
  if (data.kind !== "input") {
    return null;
  }
  const names = data.inputs.map((input) => input.name);

  return (
    <NodeShell accent={IO_ACCENT} selected={selected}>
      <BottomSourceHandle />
      <div className="text-left">
        <h3 className="text-sm font-medium text-gray-800">Inputs</h3>
        <p className="text-xs text-gray-500">{data.inputs.length} workflow input{data.inputs.length === 1 ? "" : "s"}</p>
        <div className="mt-2 flex flex-col gap-1">
          {data.inputs.map((input) => (
            <span
              key={input.name}
              className="inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              title={input.type}
            >
              <span className="inline-block h-2 w-2 rounded-sm bg-gray-900" aria-hidden="true" />
              {input.name}
            </span>
          ))}
        </div>
        {expanded ? (
          <p className="mt-2 text-[11px] text-gray-400">
            Workflow inputs feed steps through selectors like <code>$inputs.{names[0] ?? "name"}</code>.
          </p>
        ) : null}
      </div>
    </NodeShell>
  );
}
