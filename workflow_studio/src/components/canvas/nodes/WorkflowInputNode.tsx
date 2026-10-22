/**
 * Inputs node ($inputs), matching the Roboflow builder card: white rounded
 * card, selected gray glow, one reorderable chip per input (edit opens a
 * name / default panel), and the inline Add Input form (name + required type
 * Parameter / Image / Video Metadata, parameter default kind + value).
 */

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { NodeProps } from "@xyflow/react";

import { UiIcon, inputTypeIconName } from "../hollowIcons";
import type { AppNode } from "../../../adapter";
import { useEditorStore } from "../../../state/editorStore";
import { NodeTrays } from "./NodeChrome";
import { BottomSourceHandle } from "./shared";

const HELP =
  "Define what data your workflow needs to run. For example, add an Image input if your workflow processes photos, or a Parameter input for settings like confidence thresholds. When you or others run this workflow, they'll provide these values.";

const SELECTED_SHADOW = "0px 0px 20px 0px rgba(107, 114, 128, 0.25), 0px 0px 40px 0px rgba(107, 114, 128, 0.1)";

/** Official Add Input types. Image is stored as InferenceImage. */
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "WorkflowParameter", label: "Parameter" },
  { value: "InferenceImage", label: "Image" },
  { value: "WorkflowVideoMetadata", label: "Video Metadata" },
];

const PARAM_KINDS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "object", label: "JSON object" },
] as const;
type ParamKind = (typeof PARAM_KINDS)[number]["value"];

const FIELD =
  "nodrag w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 outline-none focus:border-purple-500";
const MENU_BUTTON =
  "flex h-7 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700";
const TEXT_INPUT =
  "h-[32px] min-h-[32px] w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 outline-none placeholder:text-xs focus:border-purple-500";

function parseDefaultValue(kind: ParamKind, raw: string): { ok: true; value?: unknown } | { ok: false; message: string } {
  if (!raw) {
    return { ok: true, value: undefined };
  }
  if (kind === "string") {
    return { ok: true, value: raw };
  }
  if (kind === "number") {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed)) {
      return { ok: false, message: "Invalid number value" };
    }
    return { ok: true, value: parsed };
  }
  if (kind === "boolean") {
    return { ok: true, value: raw.toLowerCase() === "true" };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid parameter type" };
  }
}

function kindFromValue(value: unknown): ParamKind {
  if (value == null) {
    return "string";
  }
  const kind = typeof value;
  if (kind === "string" || kind === "number" || kind === "boolean" || kind === "object") {
    return kind;
  }
  return "string";
}

function textFromValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function previewDefault(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 30 ? `${text.slice(0, 27)}...` : text;
}

function duplicateMessage(name: string): string {
  return `There's already an input called "${name}".`;
}

function MenuList({
  options,
  value,
  onPick,
}: {
  options: { value: string; label: string }[];
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-1 min-w-full rounded-lg bg-white p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]">
      {options.map((option) => {
        const picked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-current={picked ? "true" : undefined}
            onClick={() => onPick(option.value)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
              picked ? "bg-purple-50 text-purple-600" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{option.label}</span>
            {picked ? <UiIcon name="check" className="text-sm text-purple-600" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function WorkflowInputNode(props: NodeProps<AppNode>) {
  const { id, data, selected } = props;
  const open = useEditorStore((state) => state.expandedNodeId === id);
  const addWorkflowInput = useEditorStore((state) => state.addWorkflowInput);
  const removeWorkflowInput = useEditorStore((state) => state.removeWorkflowInput);
  const moveWorkflowInput = useEditorStore((state) => state.moveWorkflowInput);
  const editWorkflowInput = useEditorStore((state) => state.editWorkflowInput);
  const [formOpen, setFormOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [paramKind, setParamKind] = useState<ParamKind>("string");
  const [defaultRaw, setDefaultRaw] = useState("");
  const [menu, setMenu] = useState<"type" | "kind" | "bool" | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<ParamKind>("string");
  const [editRaw, setEditRaw] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragImage = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target as Element).closest?.("[data-input-form]")) {
        setMenu(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  if (data.kind !== "input") {
    return null;
  }

  const trimmedName = nameDraft.trim();
  const isParameter = typeDraft === "WorkflowParameter";
  const canAdd = trimmedName.length > 0 && typeDraft.length > 0;
  const taken = (name: string, except?: string): boolean =>
    data.inputs.some((input) => input.name === name && input.name !== except);

  const resetForm = (): void => {
    setFormOpen(false);
    setNameDraft("");
    setTypeDraft("");
    setParamKind("string");
    setDefaultRaw("");
    setMenu(null);
    setNameError(null);
    setDefaultError(null);
  };

  const submit = (): void => {
    if (!canAdd) {
      return;
    }
    if (taken(trimmedName)) {
      setNameError(duplicateMessage(trimmedName));
      return;
    }
    let defaultValue: unknown;
    if (isParameter && defaultRaw) {
      const parsed = parseDefaultValue(paramKind, defaultRaw);
      if (!parsed.ok) {
        setDefaultError(parsed.message);
        return;
      }
      defaultValue = parsed.value;
    }
    addWorkflowInput(
      trimmedName,
      typeDraft,
      isParameter && defaultValue !== undefined ? [paramKind] : undefined,
      defaultValue,
    );
    resetForm();
  };

  const closeEdit = (): void => {
    setEditing(null);
    setEditName("");
    setEditRaw("");
    setEditError(null);
    setMenu(null);
  };

  const saveEdit = (original: string, parameter: boolean): void => {
    const next = editName.trim();
    if (next && next !== original && taken(next, original)) {
      setEditError(duplicateMessage(next));
      return;
    }
    let defaultValue: unknown;
    if (parameter) {
      const parsed = parseDefaultValue(editKind, editRaw);
      if (!parsed.ok) {
        setEditError(parsed.message);
        return;
      }
      defaultValue = parsed.value;
    }
    editWorkflowInput(
      original,
      next || original,
      parameter ? (defaultValue === undefined ? "clear" : { value: defaultValue, kind: [editKind] }) : undefined,
    );
    closeEdit();
  };

  const onChipDragStart = (event: DragEvent<HTMLDivElement>, index: number): void => {
    setDragFrom(index);
    event.dataTransfer.effectAllowed = "move";
    const source = event.currentTarget;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    clone.style.boxShadow = "none";
    clone.querySelectorAll("[data-drag-hide]").forEach((node) => node.remove());
    document.body.appendChild(clone);
    event.dataTransfer.setDragImage(clone, 0, 0);
    dragImage.current = clone;
  };

  const onChipDragEnd = (): void => {
    if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
      const name = data.inputs[dragFrom]?.name;
      if (name) {
        moveWorkflowInput(name, dragOver);
      }
    }
    setDragFrom(null);
    setDragOver(null);
    dragImage.current?.remove();
    dragImage.current = null;
  };

  return (
    <div
      className={`workflow-input-node group relative min-w-[280px] rounded-lg border bg-white shadow-sm transition-all duration-300 hover:shadow-md ${
        selected ? "border-gray-300 bg-gradient-to-b from-gray-50/30 to-white" : "border-gray-200"
      }`}
      style={selected ? { boxShadow: SELECTED_SHADOW } : undefined}
    >
      <BottomSourceHandle />
      {open ? <NodeTrays nodeId={id} showProducers={false} /> : null}
      <div className="flex items-start justify-between border-b border-gray-100 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
            <UiIcon name="arrow-down-to-line" className="text-lg text-gray-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">Inputs</div>
            <div className="text-[10px] text-gray-600">Data your workflow needs to run</div>
          </div>
        </div>
        <span
          className="relative flex h-5 w-5 cursor-help items-center justify-center rounded-full text-gray-400 transition duration-200 hover:bg-gray-100 hover:text-gray-500"
          title={HELP}
        >
          <UiIcon name="help" className="text-xs" />
        </span>
      </div>
      <div className="p-3">
        <div className="space-y-3">
          {data.inputs.map((input, index) => {
            const parameter = input.type === "WorkflowParameter" || input.type === "InferenceParameter";
            const preview = parameter ? previewDefault(input.default_value) : null;
            const shift =
              dragFrom !== null && dragOver !== null && dragFrom !== dragOver && index !== dragFrom
                ? dragFrom < dragOver && index > dragFrom && index <= dragOver
                  ? "-translate-y-8"
                  : dragFrom > dragOver && index >= dragOver && index < dragFrom
                    ? "translate-y-8"
                    : ""
                : "";
            return (
              <div
                key={input.name}
                draggable={editing !== input.name}
                onDragStart={(event) => onChipDragStart(event, index)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragFrom !== null && index !== dragOver) {
                    setDragOver(index);
                  }
                }}
                onDrop={(event) => event.preventDefault()}
                onDragEnd={onChipDragEnd}
                className={`nodrag group/item transition-transform duration-200 ${dragFrom === index ? "opacity-0" : ""} ${shift}`}
              >
                {editing === input.name ? (
                  <div className="rounded border border-purple-200 bg-purple-50/30 p-3" data-input-form>
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-700">Name</span>
                        <input
                          type="text"
                          aria-label="Input name"
                          value={editName}
                          autoFocus
                          onChange={(event) => {
                            setEditName(event.target.value);
                            setEditError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveEdit(input.name, parameter);
                            }
                            if (event.key === "Escape") {
                              closeEdit();
                            }
                          }}
                          className={FIELD}
                        />
                      </label>
                      {parameter ? (
                        <DefaultValueFields
                          kind={editKind}
                          raw={editRaw}
                          menu={menu}
                          error={editError?.includes("already an input") ? null : editError}
                          onToggle={(which) => setMenu(menu === which ? null : which)}
                          onKind={(kind) => {
                            setEditKind(kind);
                            setEditRaw("");
                            setEditError(null);
                            setMenu(null);
                          }}
                          onRaw={(value) => {
                            setEditRaw(value);
                            setEditError(null);
                          }}
                          onBool={(value) => {
                            setEditRaw(value);
                            setMenu(null);
                            setEditError(null);
                          }}
                        />
                      ) : null}
                      {editError?.includes("already an input") ? (
                        <div className="break-words text-[10px] text-red-500">{editError}</div>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={closeEdit}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(input.name, parameter)}
                          className="flex-1 rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex cursor-grab items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 active:cursor-grabbing">
                    <UiIcon name={inputTypeIconName(input.type)} className="text-xs" />
                    <span title={input.type}>{input.name}</span>
                    {preview ? (
                      <span data-drag-hide="true" className="max-w-[80px] truncate text-[10px] text-gray-400">
                        = {preview}
                      </span>
                    ) : null}
                    <div className="ml-0.5 flex items-center" data-drag-hide="true">
                      <button
                        type="button"
                        aria-label={`Rename input ${input.name}`}
                        title="Edit"
                        onClick={() => {
                          setEditing(input.name);
                          setEditName(input.name);
                          setEditKind(kindFromValue(input.default_value));
                          setEditRaw(textFromValue(input.default_value));
                          setEditError(null);
                        }}
                        className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <UiIcon name="edit" className="text-[10px]" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete input ${input.name}`}
                        title="Remove"
                        onClick={() => removeWorkflowInput(input.name)}
                        className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <UiIcon name="x" className="text-[10px]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {formOpen ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3" data-input-form>
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-700">Name</span>
                  <input
                    type="text"
                    aria-label="New input name"
                    placeholder="input_name"
                    value={nameDraft}
                    autoFocus
                    aria-invalid={nameError ? true : false}
                    onChange={(event) => {
                      setNameDraft(event.target.value);
                      if (nameError) {
                        setNameError(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    className={`${FIELD} ${nameError ? "border-red-500 focus:border-red-500" : ""}`}
                  />
                  {nameError ? <span className="break-words text-[10px] text-red-500">{nameError}</span> : null}
                </label>
                <div className="nodrag relative flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-700">Type</span>
                  <button
                    type="button"
                    aria-label="Select input type"
                    onClick={() => setMenu(menu === "type" ? null : "type")}
                    className={MENU_BUTTON}
                  >
                    <span>{TYPE_OPTIONS.find((option) => option.value === typeDraft)?.label ?? "Select type..."}</span>
                    <UiIcon name="chevron-down" className="text-xs text-gray-400 opacity-75" />
                  </button>
                  {menu === "type" ? (
                    <MenuList
                      options={TYPE_OPTIONS}
                      value={typeDraft}
                      onPick={(value) => {
                        setTypeDraft(value);
                        setParamKind("string");
                        setDefaultRaw("");
                        setDefaultError(null);
                        setMenu(null);
                      }}
                    />
                  ) : null}
                </div>
                {isParameter ? (
                  <DefaultValueFields
                    kind={paramKind}
                    raw={defaultRaw}
                    menu={menu}
                    error={defaultError}
                    onToggle={(which) => setMenu(menu === which ? null : which)}
                    onKind={(kind) => {
                      setParamKind(kind);
                      setDefaultRaw("");
                      setDefaultError(null);
                      setMenu(null);
                    }}
                    onRaw={(value) => {
                      setDefaultRaw(value);
                      setDefaultError(null);
                    }}
                    onBool={(value) => {
                      setDefaultRaw(value);
                      setDefaultError(null);
                      setMenu(null);
                    }}
                  />
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex h-[32px] min-h-[32px] flex-1 items-center justify-center rounded-lg border border-gray-300 px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canAdd}
                    className="flex h-[32px] min-h-[32px] flex-1 items-center justify-center rounded-lg bg-purple-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Add input"
              onClick={() => setFormOpen(true)}
              className="h-[32px] min-h-[32px] w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              <UiIcon name="plus" className="mr-1 inline-block text-xs" />
              <span>Add Input</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultValueFields({
  kind,
  raw,
  menu,
  error,
  onToggle,
  onKind,
  onRaw,
  onBool,
}: {
  kind: ParamKind;
  raw: string;
  menu: "type" | "kind" | "bool" | null;
  error: string | null;
  onToggle: (which: "kind" | "bool") => void;
  onKind: (kind: ParamKind) => void;
  onRaw: (value: string) => void;
  onBool: (value: string) => void;
}) {
  const kindLabel = PARAM_KINDS.find((option) => option.value === kind)?.label ?? kind;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-700">Default value</span>
      <div className="nodrag flex flex-col gap-2">
        <div className="relative">
          <button type="button" aria-label="Select default value type" onClick={() => onToggle("kind")} className={MENU_BUTTON}>
            <span>{kindLabel}</span>
            <UiIcon name="chevron-down" className="text-xs text-gray-400 opacity-75" />
          </button>
          {menu === "kind" ? (
            <MenuList options={[...PARAM_KINDS]} value={kind} onPick={(value) => onKind(value as ParamKind)} />
          ) : null}
        </div>
        {kind === "boolean" ? (
          <div className="relative">
            <button type="button" aria-label="Default value" onClick={() => onToggle("bool")} className={MENU_BUTTON}>
              <span>{raw || "Select..."}</span>
              <UiIcon name="chevron-down" className="text-xs text-gray-400 opacity-75" />
            </button>
            {menu === "bool" ? (
              <MenuList
                options={[
                  { value: "true", label: "true" },
                  { value: "false", label: "false" },
                ]}
                value={raw}
                onPick={onBool}
              />
            ) : null}
          </div>
        ) : kind === "object" ? (
          <textarea
            aria-label="Default value"
            placeholder='{"key": "value"}'
            value={raw}
            rows={3}
            onChange={(event) => onRaw(event.target.value)}
            className="cursor-text overflow-auto rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-purple-500"
          />
        ) : (
          <input
            type={kind === "number" ? "number" : "text"}
            aria-label="Default value"
            placeholder="Enter default value (optional)"
            value={raw}
            onChange={(event) => onRaw(event.target.value)}
            className={TEXT_INPUT}
          />
        )}
      </div>
      {error ? <div className="max-w-[220px] break-words text-[10px] text-red-500">{error}</div> : null}
    </div>
  );
}
