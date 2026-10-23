/**
 * Outputs node ($outputs). Matches the builder card: down-arrow header, one
 * row per committed output (name, rename/delete, source chip), and an Add
 * Output form (name + field picker, or drop a tray chip) that commits only
 * on Add. A drop on an existing chip rebinds that row.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DragEvent, RefObject } from "react";
import type { NodeProps } from "@xyflow/react";

import {
  blockDisplayName,
  blockSectionOf,
  faClasses,
  nextOutputName,
  outputBaseName,
  sectionMetaOf,
} from "../../../adapter";
import type { AppNode } from "../../../adapter";
import type { BlockRegistry } from "../../../types/registry";
import type { WorkflowSpecification } from "../../../types/spec";
import { stepsToList } from "../../../types/spec";
import { WF_SELECTOR_DRAG_TYPE } from "../ConfigForm";
import { UiIcon, inputTypeIconName, outputFieldIconName } from "../hollowIcons";
import { useEditorStore } from "../../../state/editorStore";
import { useRegistryStore } from "../../../state/registryStore";
import { NodeTrays } from "./NodeChrome";
import { FIELD_ACTION, FIELD_CONTROL, FIELD_MENU, TopTargetHandle } from "./shared";

const GENERIC_KINDS = new Set(["string", "integer", "float", "number", "boolean", "any", "dict", "list"]);

/** Same 32px control chrome as Inputs and step forms. */
const FORM_ACTION =
  "flex h-8 min-h-8 flex-1 items-center justify-center rounded-lg px-2.5 text-xs font-medium transition-colors";

interface FieldRow {
  selector: string;
  label: string;
  description: string;
  icon: string;
  tint?: string;
  color?: string;
}

interface FieldGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  rows: FieldRow[];
}

function humanize(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isGenericKind(kind: string): boolean {
  return kind === "*" || kind.endsWith("/*") || GENERIC_KINDS.has(kind);
}

function inputNoun(type: string): string {
  if (type.includes("VideoMetadata")) {
    return "Video Metadata";
  }
  if (type.includes("Video")) {
    return "Video";
  }
  if (type.includes("Parameter")) {
    return "Parameter";
  }
  return "Image";
}

function fieldTitle(outputName: string, kindName?: string): string {
  if (outputName === "all_properties" || outputName === "*") {
    return "All Properties";
  }
  if (kindName && !isGenericKind(kindName)) {
    return humanize(kindName);
  }
  return humanize(outputName);
}

/** `$steps.model_1.predictions` → `model_1.predictions`; `.*` displays as all_properties. */
function selectorChipLabel(selector: string): string {
  if (selector.startsWith("$steps.")) {
    const rest = selector.slice("$steps.".length);
    if (rest.endsWith(".*")) {
      return `${rest.slice(0, -2)}.all_properties`;
    }
    return rest;
  }
  if (selector.startsWith("$inputs.")) {
    return `inputs.${selector.slice("$inputs.".length)}`;
  }
  return selector.replace(/^\$/, "");
}

function readDragSelector(event: DragEvent): string {
  const selector = event.dataTransfer.getData(WF_SELECTOR_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
  return selector.startsWith("$") ? selector : "";
}

function dragCarriesSelector(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(WF_SELECTOR_DRAG_TYPE);
}

function outputFieldGroups(spec: WorkflowSpecification | null, registry: BlockRegistry | null): FieldGroup[] {
  const blocksByType = new Map((registry?.blocks ?? []).map((block) => [block.manifest_type_identifier, block]));
  const groups: FieldGroup[] = [
    {
      id: "$inputs",
      title: "inputs",
      icon: <UiIcon name="arrow-down-to-line" className="text-xs" />,
      rows: (spec?.inputs ?? []).map((input) => ({
        selector: `$inputs.${input.name}`,
        label: input.name,
        description: `${inputNoun(input.type)} from workflow input "${input.name}"`,
        icon: inputTypeIconName(input.type),
      })),
    },
  ];
  for (const { name, step } of stepsToList(spec?.steps ?? [])) {
    const block = blocksByType.get(step.type);
    const meta = sectionMetaOf(blockSectionOf(step.type));
    const display = block ? blockDisplayName(block) : name;
    const named = [...(block?.outputs_manifest ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    const listed = named.length > 0 ? named : [{ name: "*", kind: [] as { name: string }[] }];
    const rows: FieldRow[] = listed.map((output) => ({
      selector: output.name === "*" ? `$steps.${name}` : `$steps.${name}.${output.name}`,
      label: output.name,
      description: `${fieldTitle(output.name, output.kind[0]?.name)} from ${display}`,
      icon: outputFieldIconName(output.name, output.kind[0]?.name),
      tint: meta.tint,
      color: meta.color,
    }));
    groups.push({
      id: `$steps.${name}`,
      title: name,
      icon: (
        <i className={`${faClasses(block?.block_schema?.ui_manifest?.icon ?? "far fa-cube")} text-xs`} aria-hidden="true" />
      ),
      rows,
    });
  }
  return groups;
}

/** Field list hangs from the field input: left-aligned with it, wide enough that descriptions stay on one line. */
function FieldMenu({
  groups,
  anchorRef,
  onPick,
}: {
  groups: FieldGroup[];
  anchorRef: RefObject<HTMLElement | null>;
  onPick: (selector: string) => void;
}) {
  const [box, setBox] = useState<{ top: number; left: number; minWidth: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const place = (): void => {
      const anchor = anchorRef.current;
      if (anchor) {
        const trigger = anchor.getBoundingClientRect();
        const top = Math.round(trigger.bottom + 4);
        const next = {
          top,
          left: Math.round(trigger.left),
          minWidth: Math.round(trigger.width),
          maxHeight: Math.min(520, Math.max(120, Math.round(window.innerHeight - top - 12))),
        };
        setBox((current) =>
          current &&
          current.top === next.top &&
          current.left === next.left &&
          current.minWidth === next.minWidth &&
          current.maxHeight === next.maxHeight
            ? current
            : next,
        );
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [anchorRef]);

  if (!box) {
    return null;
  }

  return createPortal(
    <div
      data-field-menu
      className="nodrag nowheel fixed z-[1100] w-max overflow-y-auto rounded-lg bg-white py-1 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_8px_24px_-4px_rgba(0,0,0,0.18)]"
      style={{ top: box.top, left: box.left, minWidth: box.minWidth, maxHeight: box.maxHeight }}
    >
      {groups.map((group) => (
        <div key={group.id} className="border-b border-gray-100 py-2 last:border-b-0">
          <div className="flex items-center gap-2 px-3 py-1 text-gray-700">
            <span className="flex w-4 justify-center">{group.icon}</span>
            <span className="text-sm font-medium">{group.title}</span>
          </div>
          {group.rows.map((row) => (
            <button
              key={row.selector}
              type="button"
              onClick={() => onPick(row.selector)}
              className="block w-max min-w-full px-3 py-1.5 text-left hover:bg-gray-50"
            >
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                style={chipColors(row, false)}
              >
                <UiIcon name={row.icon} className="text-xs" />
                <span>{row.label}</span>
              </span>
              <div className="mt-1 whitespace-nowrap text-xs text-gray-500">{row.description}</div>
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function chipColors(row: { tint?: string; color?: string } | undefined, dangling: boolean): React.CSSProperties | undefined {
  if (dangling) {
    return undefined;
  }
  if (row?.tint && row.color) {
    return { backgroundColor: row.tint, color: row.color, borderColor: row.tint };
  }
  return { backgroundColor: "#F9FAFB", color: "#374151", borderColor: "#E5E7EB" };
}

export function WorkflowOutputNode(props: NodeProps<AppNode>) {
  const { id, data } = props;
  const open = useEditorStore((state) => state.expandedNodeId === id);
  const setOutputBinding = useEditorStore((state) => state.setOutputBinding);
  const addWorkflowOutput = useEditorStore((state) => state.addWorkflowOutput);
  const removeWorkflowOutput = useEditorStore((state) => state.removeWorkflowOutput);
  const renameWorkflowOutput = useEditorStore((state) => state.renameWorkflowOutput);
  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState<string | null>(null);
  const [cardDrop, setCardDrop] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [selectorDraft, setSelectorDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [bindingMenu, setBindingMenu] = useState<string | null>(null);
  const fieldButtonRef = useRef<HTMLButtonElement>(null);
  const bindingButtonRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => outputFieldGroups(spec, registry), [spec, registry]);
  const rowsBySelector = useMemo(() => {
    const map = new Map<string, FieldRow>();
    for (const group of groups) {
      for (const row of group.rows) {
        map.set(row.selector, row);
      }
    }
    // all_properties is drag-only (not a real manifest output), so it is absent
    // from the field menu. Bound chips still take the source block's tint and icon.
    const blocksByType = new Map((registry?.blocks ?? []).map((block) => [block.manifest_type_identifier, block]));
    for (const { name, step } of stepsToList(spec?.steps ?? [])) {
      const block = blocksByType.get(step.type);
      if (!(block?.outputs_manifest ?? []).length) {
        continue;
      }
      const meta = sectionMetaOf(blockSectionOf(step.type));
      const selector = `$steps.${name}.all_properties`;
      const row: FieldRow = {
        selector,
        label: "all_properties",
        description: "",
        icon: outputFieldIconName("all_properties"),
        tint: meta.tint,
        color: meta.color,
      };
      // Drag payload keeps the label; the stored binding is `$steps.<name>.*`.
      map.set(selector, row);
      map.set(`$steps.${name}.*`, { ...row, selector: `$steps.${name}.*` });
    }
    return map;
  }, [groups, spec, registry]);

  useEffect(() => {
    if (!menuOpen && !bindingMenu) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Element;
      const inMenu = Boolean(target.closest?.("[data-field-menu]"));
      if (menuOpen && !inMenu && !target.closest?.("[data-output-form]")) {
        setMenuOpen(false);
      }
      if (bindingMenu && !inMenu && !target.closest?.("[data-binding-menu]")) {
        setBindingMenu(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, bindingMenu]);

  if (data.kind !== "output") {
    return null;
  }

  const taken = (name: string): boolean => data.outputs.some((output) => output.name === name);

  const resetForm = (): void => {
    setFormOpen(false);
    setNameDraft("");
    setNameTouched(false);
    setSelectorDraft("");
    setMenuOpen(false);
    setNameError(null);
  };

  const applySelector = (selector: string): void => {
    setSelectorDraft(selector);
    setMenuOpen(false);
    setFormOpen(true);
    if (!nameTouched) {
      const existing = data.outputs.map((output) => output.name);
      setNameDraft(nextOutputName(existing, outputBaseName(selector)));
    }
  };

  const submit = (): void => {
    if (!selectorDraft) {
      return;
    }
    const existing = data.outputs.map((output) => output.name);
    const name = nameDraft.trim() || nextOutputName(existing, outputBaseName(selectorDraft));
    if (taken(name)) {
      setNameError(`There's already an output called "${name}".`);
      return;
    }
    addWorkflowOutput(name, selectorDraft);
    resetForm();
  };

  const onCardDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!dragCarriesSelector(event)) {
      return;
    }
    setCardDrop(true);
  };

  const onCardDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!dragCarriesSelector(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
  };

  const onCardDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setCardDrop(false);
    setDropActive(null);
  };

  const onCardDrop = (event: DragEvent<HTMLDivElement>): void => {
    setCardDrop(false);
    setDropActive(null);
    const selector = readDragSelector(event);
    if (!selector) {
      return;
    }
    event.preventDefault();
    applySelector(selector);
  };

  const draftRow = rowsBySelector.get(selectorDraft);

  return (
    <div
      className={`workflow-output-node group relative w-[280px] rounded-lg border-2 bg-white shadow-sm transition-all duration-300 hover:shadow-md ${
        cardDrop ? "border-dashed border-purple-400" : "border-gray-200"
      }`}
      onDragEnter={onCardDragEnter}
      onDragOver={onCardDragOver}
      onDragLeave={onCardDragLeave}
      onDrop={onCardDrop}
    >
      <TopTargetHandle />
      {open ? <NodeTrays nodeId={id} /> : null}
      <div className="flex items-start justify-between border-b border-gray-100 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
            <UiIcon name="arrow-down-from-line" className="text-lg text-gray-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">Outputs</div>
            <div className="text-[10px] text-gray-600">Results your workflow returns</div>
          </div>
        </div>
        <span
          className="relative flex h-5 w-5 cursor-help items-center justify-center rounded-full text-gray-400 transition duration-200 hover:bg-gray-100 hover:text-gray-500"
          title="Choose which block fields this workflow returns."
        >
          <UiIcon name="help" className="text-xs" />
        </span>
      </div>
      <div className="p-3">
        <div className="space-y-3">
          {data.outputs.length === 0 && !formOpen ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
              No Connected Blocks
              <div className="mt-0.5 text-[10px]">
                Connect workflow blocks to this output block to define what your workflow returns.
              </div>
            </div>
          ) : null}
          {data.outputs.map((output) => {
            const dangling = data.danglingOutputs.includes(output.name);
            const row = output.selector ? rowsBySelector.get(output.selector) : undefined;
            const active = dropActive === output.name;
            return (
              <div key={output.name} className="nodrag group/item">
                <div className="mb-1 flex items-center justify-between gap-2">
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
                      className={FIELD_CONTROL}
                    />
                  ) : (
                    <>
                      <span className={`min-w-0 truncate text-sm font-medium ${dangling ? "text-red-600" : "text-gray-700"}`}>
                        {output.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`Rename output ${output.name}`}
                          onClick={() => setRenaming(output.name)}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <UiIcon name="edit" className="text-xs" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete output ${output.name}`}
                          onClick={() => removeWorkflowOutput(output.name)}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        >
                          <UiIcon name="x" className="text-xs" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {output.selector ? (
                  <div
                    className={`inline-flex max-w-full rounded-lg border-2 border-dashed p-0.5 ${
                      active ? "border-purple-400" : "border-transparent"
                    }`}
                    onDragOver={(event) => {
                      if (!dragCarriesSelector(event)) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "link";
                      setDropActive(output.name);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setCardDrop(false);
                      setDropActive(null);
                      const selector = readDragSelector(event);
                      if (selector) {
                        setOutputBinding(output.name, selector);
                      }
                    }}
                  >
                    <span
                      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                        dangling ? "border-red-300 bg-red-50 text-red-600" : ""
                      }`}
                      style={chipColors(row, dangling)}
                      title={output.selector}
                    >
                      <UiIcon name={row?.icon ?? "box"} className="text-xs" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {selectorChipLabel(output.selector)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="relative" data-binding-menu>
                    <button
                      type="button"
                      ref={bindingMenu === output.name ? bindingButtonRef : undefined}
                      aria-label={`Select field for ${output.name}`}
                      aria-expanded={bindingMenu === output.name}
                      className={`${FIELD_MENU} text-gray-400`}
                      onClick={() => setBindingMenu(bindingMenu === output.name ? null : output.name)}
                    >
                      <span>Select a Field...</span>
                      <UiIcon name="chevron-down" className="text-xs text-gray-400 opacity-75" />
                    </button>
                    {bindingMenu === output.name ? (
                      <FieldMenu
                        groups={groups}
                        anchorRef={bindingButtonRef}
                        onPick={(selector) => {
                          setOutputBinding(output.name, selector);
                          setBindingMenu(null);
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
          {formOpen ? (
            <form
              data-output-form
              className="nodrag flex flex-col gap-3 rounded border border-gray-200 bg-gray-50 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700">Name</span>
                <input
                  type="text"
                  aria-label="New output name"
                  placeholder="output_name"
                  value={nameDraft}
                  autoFocus
                  aria-invalid={nameError ? true : undefined}
                  onChange={(event) => {
                    setNameDraft(event.target.value);
                    setNameTouched(true);
                    setNameError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  className={`${FIELD_CONTROL} ${nameError ? "border-red-500 focus:border-red-500" : ""}`}
                />
                {nameError ? <span className="break-words text-[10px] text-red-500">{nameError}</span> : null}
              </label>
              <div className="relative flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700">Field</span>
                {selectorDraft ? (
                  <div className="flex">
                    <span
                      className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                      style={chipColors(draftRow, false)}
                      title={selectorDraft}
                    >
                      <UiIcon name={draftRow?.icon ?? "box"} className="text-xs" />
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {selectorChipLabel(selectorDraft)}
                      </span>
                      <button
                        type="button"
                        aria-label="Clear field"
                        onClick={() => {
                          setSelectorDraft("");
                          if (!nameTouched) {
                            setNameDraft("");
                          }
                        }}
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-current hover:bg-black/10"
                      >
                        <UiIcon name="x" className="text-xs" />
                      </button>
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      ref={fieldButtonRef}
                      aria-label="Select a field"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((value) => !value)}
                      className={`${FIELD_MENU} text-gray-400`}
                    >
                      <span>Select a Field...</span>
                      <UiIcon name="chevron-down" className="text-xs text-gray-400 opacity-75" />
                    </button>
                    {menuOpen ? (
                      <FieldMenu groups={groups} anchorRef={fieldButtonRef} onPick={applySelector} />
                    ) : null}
                    <div
                      className={`rounded-lg border border-dashed px-2.5 py-1.5 text-center text-xs text-gray-400 ${
                        cardDrop ? "border-purple-300 bg-purple-50/40" : "border-gray-300"
                      }`}
                    >
                      Or Drag from Panel
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className={`${FORM_ACTION} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectorDraft}
                  className={`${FORM_ACTION} bg-purple-600 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300`}
                >
                  Add
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              aria-label="Add output"
              onClick={() => setFormOpen(true)}
              className={FIELD_ACTION}
            >
              <UiIcon name="plus" className="text-xs" />
              <span>Add Output</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
