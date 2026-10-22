/**
 * Step node card, mirroring the official builder: wrapper with section-colored
 * left accent, header (tinted icon chip + small-caps block name + bold
 * instance name + pink error button), the schema-driven config form when
 * selected, the action bar above and the side trays beside, "Powered by
 * Inference" footer, 20px top/bottom handles.
 */

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { blockDisplayName, blockShortName, errorsForNodeKey, faClasses, sectionMetaOf } from "../../../adapter";
import type { AppNode } from "../../../adapter";
import { ConfigForm } from "../ConfigForm";
import { UiIcon } from "../hollowIcons";
import { selectValidation, useEditorStore } from "../../../state/editorStore";
import { useRunStore } from "../../../state/runStore";
import { NodeActionBar, NodeTrays, docsSlugFor } from "./NodeChrome";
import { TopTargetHandle, BottomSourceHandle } from "./shared";

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
  // The OPEN state is the single toggle (single click opens, clicking the
  // open node again closes it); react-flow selection is visual only.
  const expanded = useEditorStore((state) => state.expandedNodeId === id);
  const removeNodes = useEditorStore((state) => state.removeNodes);
  const renameStepNode = useEditorStore((state) => state.renameStepNode);
  const toggleNodeDisabled = useEditorStore((state) => state.toggleNodeDisabled);
  const addNoteAt = useEditorStore((state) => state.addNoteAt);
  const toggleRunPanel = useEditorStore((state) => state.toggleRunPanel);
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
  const { step, stepName, block, selectorProps, section, disabled, hasDanglingRef } = data;
  const title = block ? blockDisplayName(block) : blockShortName(step.type);
  const meta = sectionMetaOf(section);
  const icon = block?.block_schema?.ui_manifest?.icon ?? "far fa-cube";
  const description = block?.block_schema?.short_description;

  return (
    <div className="stepNodeWrapper group relative flex w-[280px] overflow-visible" style={{ width: 280 }}>
      <TopTargetHandle />
      <BottomSourceHandle />
      {expanded ? (
        <NodeActionBar
          description={description}
          docsSlug={docsSlugFor(step.type)}
          jsonOpen={showJson}
          onToggleJson={() => setShowJson(!showJson)}
          onTest={toggleRunPanel}
          onRename={() => setRenaming(!renaming)}
          onAddNote={() => addNoteAt({ x: positionAbsoluteX + 320, y: positionAbsoluteY })}
          disabled={disabled}
          onToggleDisabled={() => toggleNodeDisabled(id)}
          onDelete={() => removeNodes([id])}
        />
      ) : null}
      {expanded ? <NodeTrays nodeId={id} /> : null}
      {expanded ? (
        // Official expanded state: a WIDE light tint block on the left with
        // the block icon on a white chip riding on it (collapsed keeps the
        // thin saturated accent bar).
        <>
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 z-20 w-12 rounded-l-lg"
            style={{ backgroundColor: meta.tint }}
          />
          <span
            aria-hidden="true"
            className="absolute left-[9px] top-3 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm"
            style={{ color: meta.color }}
          >
            <i className={faClasses(icon)} />
          </span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 top-0 z-20 w-1.5 rounded-l-lg"
          style={{ backgroundColor: meta.color, opacity: disabled ? 0.4 : 1 }}
        />
      )}
      <div
        className={`graphBlock relative z-10 flex-1 rounded-lg border border-l-0 bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md ${expanded ? "pl-14" : ""}`}
        style={{
          borderColor: hasDanglingRef ? "#DC2626" : selected ? meta.color : "#E5E7EB",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div className="relative z-10 flex w-full flex-col gap-2.5">
          <div className="flex w-full cursor-pointer items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {expanded ? null : (
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm"
                  style={{ backgroundColor: meta.tint, color: meta.color }}
                >
                  <i className={faClasses(icon)} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[11px] capitalize text-gray-500">
                  <span className="truncate" title={title}>
                    {title}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-gray-800">
                  {renaming ? (
                    <input
                      type="text"
                      aria-label="Step name"
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
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    stepName
                  )}
                </div>
              </div>
            </div>
            {nodeError ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Node validation error"
                title={nodeError}
                className="flex h-7 w-7 shrink-0 cursor-help items-center justify-center rounded-full bg-pink-100"
              >
                <UiIcon name="alert" className="text-xs text-pink-800" />
              </span>
            ) : null}
          </div>

          {expanded ? (
            <ConfigForm
              stepName={stepName}
              step={step}
              schemaProperties={block?.block_schema?.properties ?? {}}
              required={block?.block_schema?.required ?? []}
              selectorProps={selectorProps}
            />
          ) : (
            <>
              <p className="truncate text-xs text-gray-400" title={summarize(step, selectorProps)}>
                {summarize(step, selectorProps) || "—"}
              </p>
              {runThumbnail ? (
                <img src={runThumbnail} alt="Run result" className="h-24 w-full rounded object-cover" />
              ) : null}
            </>
          )}

          {showJson ? (
            <pre
              aria-label="Step JSON"
              className="max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-left font-mono text-[10px] leading-4 text-gray-600"
            >
              {JSON.stringify(step, null, 2)}
            </pre>
          ) : null}

          {expanded ? (
            <div className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500">
              <div>
                <span>Powered by</span>
                <span> </span>
                <a
                  href="https://github.com/roboflow/inference"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-700"
                >
                  Inference
                </a>
                <i className={`${faClasses("fa-brands fa-github")} ml-0.5 text-black`} aria-hidden="true" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
