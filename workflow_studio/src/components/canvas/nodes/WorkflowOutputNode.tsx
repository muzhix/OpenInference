/** Outputs node ($outputs): output mapping rows; double-click to edit bindings (03 §3). */

import type { NodeProps } from "@xyflow/react";

import type { AppNode } from "../../../adapter";
import { errorsForNodeKey } from "../../../adapter";
import { SelectorInput } from "../SelectorInput";
import { selectValidation, useEditorStore } from "../../../state/editorStore";
import { PlusIcon, TrashIcon } from "../icons";
import { Button, IconButton } from "../../ui/Button";
import { NodeShell, TopTargetHandle, IO_ACCENT } from "./shared";

export function WorkflowOutputNode(props: NodeProps<AppNode>) {
  const { id, data, selected } = props;
  const expanded = useEditorStore((state) => state.expandedNodeId === id);
  const setOutputBinding = useEditorStore((state) => state.setOutputBinding);
  const addWorkflowOutput = useEditorStore((state) => state.addWorkflowOutput);
  const removeWorkflowOutput = useEditorStore((state) => state.removeWorkflowOutput);
  // Immediate dangling feedback (03 §5): first validation error aimed at $outputs.
  const nodeError = useEditorStore(
    (state) => errorsForNodeKey(selectValidation(state).errors, id)[0] ?? null,
  );
  if (data.kind !== "output") {
    return null;
  }

  return (
    <NodeShell
      accent={IO_ACCENT}
      selected={selected}
      danger={data.danglingOutputs.length > 0}
      error={nodeError}
    >
      <TopTargetHandle />
      <div className="text-left">
        <h3 className="text-sm font-medium text-gray-800">Outputs</h3>
        <p className="text-xs text-gray-500">{data.outputs.length} output{data.outputs.length === 1 ? "" : "s"}</p>
        <div className="mt-2 flex flex-col gap-1">
          {data.outputs.map((output) => (
            <div key={output.name} className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700">{output.name}</span>
              <span
                className={`truncate font-mono text-[11px] ${
                  data.danglingOutputs.includes(output.name) ? "text-danger" : "text-gray-500"
                }`}
                title={output.selector || "not bound"}
              >
                {output.selector || "not bound"}
              </span>
            </div>
          ))}
          {data.outputs.length === 0 ? <span className="text-xs text-gray-400">No outputs</span> : null}
        </div>
        {expanded ? (
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-2">
            {data.outputs.map((output) => (
              <div key={output.name} className="flex items-center gap-1">
                <span className="w-20 shrink-0 truncate text-xs font-medium text-gray-700" title={output.name}>
                  {output.name}
                </span>
                <div className="min-w-0 flex-1">
                  <SelectorInput
                    value={output.selector}
                    ariaLabel={`Output selector ${output.name}`}
                    onChange={(next) => setOutputBinding(output.name, next)}
                  />
                </div>
                <IconButton
                  label={`Delete output ${output.name}`}
                  onClick={() => removeWorkflowOutput(output.name)}
                  className="shrink-0 hover:bg-red-50 hover:text-danger"
                >
                  <TrashIcon />
                </IconButton>
              </div>
            ))}
            <Button aria-label="Add output" onClick={addWorkflowOutput} className="self-start">
              <PlusIcon />
              Add Output
            </Button>
          </div>
        ) : null}
      </div>
    </NodeShell>
  );
}
