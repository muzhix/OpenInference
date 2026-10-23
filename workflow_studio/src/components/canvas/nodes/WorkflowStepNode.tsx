/**
 * Step node card. Collapsed and expanded share one header: category accent,
 * tinted icon, block name, instance name, validation badge. Expanding reveals
 * the schema form, the additional-properties panel to the left, the action
 * bar, and the side trays.
 */

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";

import { blockDisplayName, blockShortName, errorsForNodeKey, faClasses, sectionMetaOf } from "../../../adapter";
import type { AppNode } from "../../../adapter";
import { FieldList } from "../ConfigForm";
import { poweredByOf } from "../fieldModel";
import { splitFormFields } from "../formFields";
import { UiIcon } from "../hollowIcons";
import { sectionChipStyle } from "../sectionChip";
import { selectValidation, useEditorStore } from "../../../state/editorStore";
import { useRunStore } from "../../../state/runStore";
import { NodeActionBar, NodeTrays, docsSlugFor } from "./NodeChrome";
import { AdditionalPropertiesButton, AdditionalPropertiesPanel, PoweredByFooter } from "./stepChrome";
import { TopTargetHandle, BottomSourceHandle } from "./shared";

export function WorkflowStepNode(props: NodeProps<AppNode>) {
  const { id, data, selected, positionAbsoluteX, positionAbsoluteY } = props;
  const expanded = useEditorStore((state) => state.expandedNodeId === id);
  const removeNodes = useEditorStore((state) => state.removeNodes);
  const renameStepNode = useEditorStore((state) => state.renameStepNode);
  const toggleNodeDisabled = useEditorStore((state) => state.toggleNodeDisabled);
  const addNoteAt = useEditorStore((state) => state.addNoteAt);
  const toggleRunPanel = useEditorStore((state) => state.toggleRunPanel);
  const [showJson, setShowJson] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const runThumbnail = useRunStore((state) =>
    data.kind === "step" ? state.stepThumbnails[data.stepName] : undefined,
  );
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
  const schemaProperties = block?.block_schema?.properties ?? {};
  const required = block?.block_schema?.required ?? [];
  const { primary, additional } = splitFormFields(schemaProperties, required, step, selectorProps);
  const poweredBy = poweredByOf(block?.block_schema?.ui_manifest);
  const additionalOpen = expanded && showAdditional && additional.length > 0;
  const edgeWidth = selected || expanded ? 2 : 1;
  const edgeColor = hasDanglingRef ? "#DC2626" : selected || expanded ? meta.color : "#E5E7EB";
  const accentColor = hasDanglingRef ? "#DC2626" : meta.color;

  return (
    <div className="stepNodeWrapper group relative flex w-[280px] overflow-visible" style={{ width: 280, opacity: disabled ? 0.5 : 1 }}>
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
      {additionalOpen ? (
        <AdditionalPropertiesPanel onClose={() => setShowAdditional(false)}>
          <FieldList
            stepName={stepName}
            step={step}
            keys={additional}
            schemaProperties={schemaProperties}
            required={required}
            selectorProps={selectorProps}
          />
        </AdditionalPropertiesPanel>
      ) : null}
      <div
        className="graphBlock relative z-10 flex-1 rounded-lg border bg-white py-3 pl-4 pr-3 shadow-sm transition-shadow hover:shadow-md"
        style={{
          borderStyle: "solid",
          borderTopWidth: edgeWidth,
          borderRightWidth: edgeWidth,
          borderBottomWidth: edgeWidth,
          borderLeftWidth: 4,
          borderTopColor: edgeColor,
          borderRightColor: edgeColor,
          borderBottomColor: edgeColor,
          borderLeftColor: accentColor,
        }}
      >
        <div className="relative z-10 flex w-full flex-col gap-3">
          <div className="flex w-full cursor-pointer items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base"
                style={sectionChipStyle(meta.color, "icon")}
              >
                <i className={faClasses(icon)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-gray-500" title={title}>
                  {title}
                </div>
                <div className="mt-0.5 truncate text-[15px] font-semibold leading-5 text-gray-900">
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
                      className="w-full rounded-md border border-gray-300 px-1.5 py-0.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
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
                className="flex h-8 w-8 shrink-0 cursor-help items-center justify-center rounded-full bg-pink-100"
              >
                <UiIcon name="alert" className="text-sm text-pink-700" />
              </span>
            ) : null}
          </div>

          {expanded ? (
            <FieldList
              stepName={stepName}
              step={step}
              keys={primary}
              schemaProperties={schemaProperties}
              required={required}
              selectorProps={selectorProps}
            />
          ) : runThumbnail ? (
            <img src={runThumbnail} alt="Run result" className="h-24 w-full rounded object-cover" />
          ) : null}

          {expanded && additional.length > 0 ? (
            <AdditionalPropertiesButton open={additionalOpen} onToggle={() => setShowAdditional((open) => !open)} />
          ) : null}

          {showJson ? (
            <pre
              aria-label="Step JSON"
              className="max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-left font-mono text-[10px] leading-4 text-gray-600"
            >
              {JSON.stringify(step, null, 2)}
            </pre>
          ) : null}

          {expanded && poweredBy ? <PoweredByFooter poweredBy={poweredBy} /> : null}
        </div>
      </div>
    </div>
  );
}
