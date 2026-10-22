/** Step node card: accent bar, title/instance name, summary, expandable config form (03 §2-3). */

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { blockDisplayName, blockShortName, errorsForNodeKey, sectionMetaOf } from "../../../adapter";
import type { AppNode } from "../../../adapter";
import { ConfigForm } from "../ConfigForm";
import { selectValidation, useEditorStore } from "../../../state/editorStore";
import { useRunStore } from "../../../state/runStore";
import { BracesIcon, NoteIcon, PencilIcon, TrashIcon } from "../icons";
import { IconButton } from "../../ui/Button";
import { NodeShell, TopTargetHandle, BottomSourceHandle } from "./shared";

function summarize(params: Record<string, unknown>, selectorProps: string[]): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === "type" || key === "name" || selectorProps.includes(key)) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}: ${String(value)}`);
    }
    if (parts.length >= 3) {
      break;
    }
  }
  const text = parts.join(" · ");
  return text.length > 52 ? `${text.slice(0, 51)}…` : text;
}

export function WorkflowStepNode(props: NodeProps<AppNode>) {
  const { id, data, selected, positionAbsoluteX, positionAbsoluteY } = props;
  const expanded = useEditorStore((state) => state.expandedNodeId === id);
  const setExpanded = useEditorStore((state) => state.setExpanded);
  const removeNodes = useEditorStore((state) => state.removeNodes);
  const renameStepNode = useEditorStore((state) => state.renameStepNode);
  const toggleNodeDisabled = useEditorStore((state) => state.toggleNodeDisabled);
  const addNoteAt = useEditorStore((state) => state.addNoteAt);
  const [showJson, setShowJson] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Run result thumbnail (D3): step name -> last run's image output, if any.
  const runThumbnail = useRunStore((state) =>
    data.kind === "step" ? state.stepThumbnails[data.stepName] : undefined,
  );
  // Immediate dangling feedback (03 §5): first validation error aimed at this node.
  const nodeError = useEditorStore((state) => {
    if (data.kind !== "step") {
      return null;
    }
    return errorsForNodeKey(selectValidation(state).errors, id)[0] ?? null;
  });

  if (data.kind !== "step") {
    return null;
  }
  const { step, stepName, block, selectorProps, outputNames, section, disabled, hasDanglingRef } = data;
  const title = block ? blockDisplayName(block) : blockShortName(step.type);

  return (
    <NodeShell
      accent={sectionMetaOf(section).color}
      selected={selected}
      dimmed={disabled}
      danger={hasDanglingRef}
      error={nodeError}
    >
      <TopTargetHandle />
      <BottomSourceHandle />

      <div className="text-left">
        <h3 className="truncate text-sm font-medium text-gray-800" title={block?.block_schema?.short_description ?? title}>
          {title}
        </h3>
        <p className="truncate text-xs text-gray-500">{stepName}</p>
        {!expanded ? (
          <>
            <p className="mt-2 truncate text-xs text-gray-400" title={summarize(step, selectorProps)}>
              {summarize(step, selectorProps) || "—"}
            </p>
            {runThumbnail ? (
              <img
                src={runThumbnail}
                alt="Run result"
                className="mt-2 h-24 w-full rounded object-cover"
              />
            ) : null}
          </>
        ) : (
          <ConfigForm
            stepName={stepName}
            step={step}
            schemaProperties={block?.block_schema?.properties ?? {}}
            required={block?.block_schema?.required ?? []}
            selectorProps={selectorProps}
          />
        )}

        {showJson ? (
          <pre
            aria-label="Step JSON"
            className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-left font-mono text-[10px] leading-4 text-gray-600"
          >
            {JSON.stringify(step, null, 2)}
          </pre>
        ) : null}

        {expanded ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setExpanded(null);
              }
            }}
          >
            <IconButton label="Show JSON" onClick={() => setShowJson(!showJson)} className={showJson ? "bg-gray-100" : ""}>
              <BracesIcon />
            </IconButton>
            <IconButton label="Rename step" onClick={() => setRenaming(!renaming)} className={renaming ? "bg-gray-100" : ""}>
              <PencilIcon />
            </IconButton>
            <IconButton
              label="Add note"
              onClick={() => addNoteAt({ x: positionAbsoluteX + 320, y: positionAbsoluteY })}
            >
              <NoteIcon />
            </IconButton>
            <IconButton
              label={disabled ? "Enable step" : "Disable step"}
              onClick={() => toggleNodeDisabled(id)}
              title={disabled ? "Enable step" : "Disable step (dim on canvas)"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                {!disabled ? <circle cx="8" cy="8" r="2" fill="currentColor" /> : null}
              </svg>
            </IconButton>
            <IconButton label="Delete step" onClick={() => removeNodes([id])} className="hover:bg-red-50 hover:text-danger">
              <TrashIcon />
            </IconButton>
            {renaming ? (
              <input
                type="text"
                aria-label="New step name"
                defaultValue={stepName}
                autoFocus
                onFocus={(event) => event.target.select()}
                onBlur={(event) => {
                  setRenaming(false);
                  const next = event.target.value.trim();
                  if (next && next !== stepName) {
                    renameStepNode(stepName, next);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setRenaming(false);
                    setExpanded(null);
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-primary"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </NodeShell>
  );
}
