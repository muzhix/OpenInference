/**
 * Outputs node ($outputs), mirroring the official card: border-2 white card,
 * header with 40px icon chip + subtitle, one row per output (label + hover
 * edit/delete, selector chip colored by the SOURCE node's section inside a
 * dashed drop zone), "Add Output" button, ONE top target handle, and the
 * inputs tray (drag to block fields) beside when selected.
 */

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { blockSectionOf, sectionMetaOf } from "../../../adapter";
import type { AppNode } from "../../../adapter";
import { stepsToList } from "../../../types/spec";
import { SelectorPicker } from "../SelectorPicker";
import { WF_SELECTOR_DRAG_TYPE } from "../ConfigForm";
import { useEditorStore } from "../../../state/editorStore";
import { NodeTrays } from "./NodeChrome";
import { UiIcon } from "../hollowIcons";
import { TopTargetHandle } from "./shared";

export function WorkflowOutputNode(props: NodeProps<AppNode>) {
  const { id, data } = props;
  const open = useEditorStore((state) => state.expandedNodeId === id);
  const setOutputBinding = useEditorStore((state) => state.setOutputBinding);
  const addWorkflowOutput = useEditorStore((state) => state.addWorkflowOutput);
  const removeWorkflowOutput = useEditorStore((state) => state.removeWorkflowOutput);
  const renameWorkflowOutput = useEditorStore((state) => state.renameWorkflowOutput);
  const spec = useEditorStore((state) => state.spec);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState<string | null>(null);
  if (data.kind !== "output") {
    return null;
  }

  /** Section of the node a selector points at, for chip coloring. */
  const sectionOfSelector = (selector: string | undefined): string => {
    if (!selector || !selector.startsWith("$")) {
      return "other";
    }
    const rest = selector.slice(1).split(".");
    if (rest[0] === "inputs") {
      return "other";
    }
    if (rest[0] === "steps" && rest[1]) {
      const entry = stepsToList(spec?.steps ?? []).find((candidate) => candidate.name === rest[1]);
      return entry ? blockSectionOf(entry.step.type) : "other";
    }
    return "other";
  };

  return (
    <div className="workflow-output-node group relative w-[280px] rounded-lg border-2 border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
      <TopTargetHandle />
      {open ? <NodeTrays nodeId={id} /> : null}
      <div className="flex items-start justify-between border-b border-gray-100 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
            <UiIcon name="arrow-up-from-line" className="text-lg text-gray-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">Outputs</div>
            <div className="text-[10px] text-gray-600">Results your workflow returns</div>
          </div>
        </div>
        <span className="cursor-help text-xs text-gray-400" title="Output rows map workflow results by selector">
          <UiIcon name="help" className="text-sm" />
        </span>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {data.outputs.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
              No Connected Blocks
              <div className="mt-0.5 text-[10px]">
                Connect workflow blocks to this output block to define what your workflow returns.
              </div>
            </div>
          ) : null}
          {data.outputs.map((output) => {
            const meta = sectionMetaOf(sectionOfSelector(output.selector));
            const dangling = data.danglingOutputs.includes(output.name);
            const bound = Boolean(output.selector);
            return (
              <div key={output.name} className="nodrag group/item">
                <div className="mb-1 flex items-center justify-between">
                  {renaming === output.name ? (
                    <input
                      type="text"
                      aria-label="Output name"
                      defaultValue={output.name}
                      autoFocus
                      onFocus={(event) => event.target.select()}
                      onBlur={(event) => {
                        setRenaming(null);
                        const next = event.target.value.trim();
                        if (next && next !== output.name) {
                          renameWorkflowOutput(output.name, next);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setRenaming(null);
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <>
                      <label className={`text-xs font-medium ${dangling ? "text-danger" : "text-gray-700"}`}>
                        {output.name}
                      </label>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
                        <button
                          type="button"
                          aria-label={`Rename output ${output.name}`}
                          onClick={() => setRenaming(output.name)}
                          className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <UiIcon name="edit" className="text-[10px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete output ${output.name}`}
                          onClick={() => removeWorkflowOutput(output.name)}
                          className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        >
                          <UiIcon name="x" className="text-[10px]" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div
                  className={`drop-zone-base rounded-lg border-2 border-dashed transition-colors ${
                    dropActive === output.name ? "border-primary bg-primary-50" : "border-transparent"
                  }`}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(WF_SELECTOR_DRAG_TYPE)) {
                      event.preventDefault();
                      setDropActive(output.name);
                    }
                  }}
                  onDragLeave={() => setDropActive(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropActive(null);
                    const selector =
                      event.dataTransfer.getData(WF_SELECTOR_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
                    if (selector.startsWith("$")) {
                      setOutputBinding(output.name, selector);
                    }
                  }}
                >
                  {bound ? (
                    <div
                      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                        dangling ? "border-danger bg-red-50 text-danger" : ""
                      }`}
                      style={
                        dangling
                          ? undefined
                          : { backgroundColor: meta.tint, color: meta.color, borderColor: meta.tint }
                      }
                      title={output.selector}
                    >
                      <UiIcon name="box" className="text-xs" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {output.selector!.replace(/^\$/, "")}
                      </span>
                      <button
                        type="button"
                        aria-label={`Clear output ${output.name}`}
                        onClick={() => setOutputBinding(output.name, "")}
                        className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-current hover:bg-black/10"
                      >
                        <UiIcon name="x" className="text-[10px]" />
                      </button>
                    </div>
                  ) : (
                    <SelectorPicker
                      property={output.name}
                      ariaLabel={`Output selector ${output.name}`}
                      onPick={(selector) => setOutputBinding(output.name, selector)}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            aria-label="Add output"
            onClick={addWorkflowOutput}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <UiIcon name="plus" className="text-sm" />
            <span>Add Output</span>
          </button>
        </div>
      </div>
    </div>
  );
}
