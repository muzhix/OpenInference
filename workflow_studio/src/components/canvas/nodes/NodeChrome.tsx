/**
 * Shared node chrome pieces observed on the official builder: the action bar
 * pinned above an expanded step node (info/docs | JSON | Test | Rename |
 * Add note | Disable | Delete), the side trays (draggable producer outputs on
 * top, the node's own outputs below), and small helpers.
 */

import { blockSectionOf, blockShortName, faClasses, sectionMetaOf } from "../../../adapter";
import { UiIcon, inputTypeIconName } from "../hollowIcons";
import { useEditorStore } from "../../../state/editorStore";
import { useRegistryStore } from "../../../state/registryStore";
import { stepsToList } from "../../../types/spec";

import { WF_SELECTOR_DRAG_TYPE } from "../ConfigForm";

export { inputTypeIconName as inputTypeIcon } from "../hollowIcons";

function BarButton({
  label,
  onClick,
  danger,
  icon,
  text,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon: React.ReactNode;
  text?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs transition-colors ${
        danger
          ? "text-pink-600 hover:bg-pink-50 hover:text-pink-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {icon}
      {text ? <span>{text}</span> : null}
    </button>
  );
}

function BarSeparator() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-200" />;
}

/** White pill pinned above the expanded step node (official hover bar). */
export function NodeActionBar({
  description,
  docsSlug,
  jsonOpen,
  onToggleJson,
  onTest,
  onRename,
  onAddNote,
  disabled,
  onToggleDisabled,
  onDelete,
}: {
  description?: string;
  docsSlug?: string;
  jsonOpen: boolean;
  onToggleJson: () => void;
  onTest: () => void;
  onRename: () => void;
  onAddNote: () => void;
  disabled: boolean;
  onToggleDisabled: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="nodrag absolute -top-12 left-1/2 z-50 flex -translate-x-1/2 pb-4">
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-lg">
        <button
          type="button"
          aria-label="Block information"
          title={description ?? "Block information"}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <UiIcon name="info" className="text-sm" />
        </button>
        {docsSlug ? (
          <a
            href={`https://inference.roboflow.com/workflows/blocks/${docsSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Block documentation"
            title="Open block documentation"
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <UiIcon name="book" className="text-sm" />
          </a>
        ) : null}
        <BarSeparator />
        <BarButton label="JSON" icon={<UiIcon name="braces" className="text-xs" />} text="JSON" onClick={onToggleJson} />
        <BarSeparator />
        <BarButton label="Test" icon={<UiIcon name="play" className="text-xs" />} text="Test" onClick={onTest} />
        <BarSeparator />
        <BarButton label="Rename" icon={<UiIcon name="edit" className="text-xs" />} text="Rename" onClick={onRename} />
        <BarSeparator />
        <BarButton label="Add note" icon={<UiIcon name="note-sticky" className="text-xs" />} text="Add note" onClick={onAddNote} />
        <BarSeparator />
        <BarButton
          label={disabled ? "Enable block" : "Disable block"}
          icon={<UiIcon name="ban" className="text-xs" />}
          text={disabled ? "Enable" : "Disable"}
          onClick={onToggleDisabled}
        />
        <BarButton label="Delete" icon={<UiIcon name="trash" className="text-xs" />} text="Delete" danger onClick={onDelete} />
      </div>
    </div>
  );
}

function TrayChip({
  selector,
  label,
  icon,
  section,
}: {
  selector: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}) {
  const meta = section ? sectionMetaOf(section) : null;
  return (
    <div
      draggable
      data-input-ref={selector}
      onDragStart={(event) => {
        event.dataTransfer.setData(WF_SELECTOR_DRAG_TYPE, selector);
        event.dataTransfer.setData("text/plain", selector);
        event.dataTransfer.effectAllowed = "link";
      }}
      className="nodrag nowheel max-w-full cursor-grab active:cursor-grabbing"
      title={`Drag to a block field to connect (${selector})`}
    >
      <span
        className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
        style={
          meta
            ? { backgroundColor: meta.tint, color: meta.color, borderColor: meta.tint }
            : { backgroundColor: "#F9FAFB", color: "#374151", borderColor: "#E5E7EB" }
        }
      >
        {icon}
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      </span>
    </div>
  );
}

function TrayCard({
  title,
  caption,
  helpTitle,
  elevated,
  children,
}: {
  title: string;
  caption?: string;
  /** Tooltip for the header "?" shown when there is no caption (official trays). */
  helpTitle?: string;
  /** Inputs summary card: one p-4 shell and a heavier shadow. */
  elevated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex w-[280px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white ${
        elevated ? "p-4 shadow-lg" : "shadow-sm"
      }`}
    >
      <div className={`flex shrink-0 items-center justify-between gap-2 ${elevated ? "mb-3" : "p-4 pb-3"}`}>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {caption ? (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <UiIcon name="move" className="text-sm text-gray-400" />
            <span>{caption}</span>
          </div>
        ) : (
          <span
            className="relative flex h-4 w-4 cursor-help items-center justify-center rounded-full text-gray-400"
            title={helpTitle ?? undefined}
          >
            <UiIcon name="help" className="text-xs" />
          </span>
        )}
      </div>
      <div className={`max-h-[400px] min-h-0 flex-1 overflow-y-auto ${elevated ? "" : "px-4 pb-4 pt-2"}`}>{children}</div>
    </div>
  );
}

/**
 * Side tray shown next to an open node: producers grouped by node (their
 * outputs as draggable chips) above, the node's own outputs below. The Inputs
 * node has no upstream producers, so it passes showProducers={false} and shows
 * only its Output summary card (observed official behavior). The tray stretches
 * the full node height (`inset-y-0`) so the Output card's bottom edge lines up
 * with the node.
 */
export function NodeTrays({ nodeId, showProducers = true }: { nodeId: string; showProducers?: boolean }) {
  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);
  if (!spec) {
    return null;
  }

  const entries = stepsToList(spec.steps);
  const blocksByType = new Map((registry?.blocks ?? []).map((block) => [block.manifest_type_identifier, block]));

  const isOutputsNode = nodeId === "$outputs";
  const selfName = nodeId.startsWith("$steps.") ? nodeId.slice("$steps.".length) : null;

  const producers: { nodeId: string; label: string; icon: React.ReactNode; section?: string; outputs: { name: string; icon: React.ReactNode }[] }[] = [];
  producers.push({
    nodeId: "$inputs",
    label: "inputs",
    icon: <UiIcon name={inputTypeIconName("WorkflowImage")} className="text-xs" />,
    outputs: (spec.inputs ?? []).map((input) => ({ name: input.name, icon: <UiIcon name={inputTypeIconName(input.type)} className="text-xs" /> })),
  });
  for (const { name, step } of entries) {
    if (name === selfName) {
      continue;
    }
    const block = blocksByType.get(step.type);
    const outputs = (block?.outputs_manifest ?? []).map((output) => ({ name: output.name, icon: <UiIcon name="box" className="text-xs" /> }));
    if (outputs.length === 0) {
      outputs.push({ name: "*", icon: <UiIcon name="asterisk" className="text-xs" /> });
    }
    producers.push({
      nodeId: `$steps.${name}`,
      label: name,
      icon: <i className={`${faClasses(block?.block_schema?.ui_manifest?.icon ?? "far fa-cube")} text-xs`} aria-hidden="true" />,
      section: blockSectionOf(step.type),
      outputs,
    });
  }

  const selfOutputs: { name: string; icon: React.ReactNode }[] =
    selfName !== null
      ? (() => {
          const step = entries.find((entry) => entry.name === selfName)?.step;
          const block = step ? blocksByType.get(step.type) : undefined;
          return (block?.outputs_manifest ?? []).map((output) => ({ name: output.name, icon: <UiIcon name="box" className="text-xs" /> }));
        })()
      : (spec.inputs ?? []).map((input) => ({ name: input.name, icon: <UiIcon name={inputTypeIconName(input.type)} className="text-xs" /> }));

  const selectorFor = (producerNodeId: string, outputName: string): string =>
    producerNodeId === "$inputs" ? `$inputs.${outputName}` : outputName === "*" ? `${producerNodeId}` : `${producerNodeId}.${outputName}`;

  const producerCount = producers.reduce((n, p) => n + p.outputs.length, 0);

  return (
    <div
      className={`pointer-events-none absolute inset-y-0 right-0 flex translate-x-full flex-col ${
        showProducers ? "justify-between pl-3" : "justify-end pl-8"
      }`}
    >
      {showProducers ? (
        <div className="pointer-events-auto">
          <div className="nodrag nowheel flex">
            <TrayCard title={`${producerCount} Input${producerCount === 1 ? "" : "s"}`} caption="Drag to block fields to connect">
              <div className="divide-y divide-gray-100">
                {producers.map((producer) => (
                  <div key={producer.nodeId} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex w-full items-center gap-2 py-1 text-left">
                      <span className="flex w-4 justify-center text-gray-700">{producer.icon}</span>
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-gray-700">
                        {producer.label}
                      </span>
                    </div>
                    <div className="ml-5 mt-1 flex flex-wrap gap-1">
                      {producer.outputs.map((output) => (
                        <TrayChip
                          key={output.name}
                          selector={selectorFor(producer.nodeId, output.name)}
                          label={output.name}
                          icon={output.icon}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TrayCard>
          </div>
        </div>
      ) : null}
      {isOutputsNode ? null : (
        <div className="pointer-events-auto">
          <div className="nodrag flex">
            <TrayCard
              title={`${selfOutputs.length} Output${selfOutputs.length === 1 ? "" : "s"}`}
              helpTitle={selfName !== null ? "Outputs this block produces" : "Workflow inputs exposed as outputs"}
              elevated={selfName === null}
            >
              <div className="flex flex-wrap gap-2">
                {selfOutputs.map((output) => (
                  <span
                    key={output.name}
                    className={`inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 ${
                      selfName === null ? "cursor-not-allowed" : ""
                    }`}
                    title={selfName !== null ? `$steps.${selfName}.${output.name}` : `$inputs.${output.name}`}
                  >
                    {output.icon}
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{output.name}</span>
                  </span>
                ))}
              </div>
            </TrayCard>
          </div>
        </div>
      )}
    </div>
  );
}

/** Docs slug for a block identifier: "roboflow_core/roboflow_x@v1" -> "x". */
export function docsSlugFor(manifestTypeIdentifier: string): string {
  return blockShortName(manifestTypeIdentifier).replace(/_/g, "-");
}
