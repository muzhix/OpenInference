/**
 * Schema-driven config form for an expanded step node.
 *
 * Primary fields render on the node. Optional fields render in the left-hand
 * Additional Properties panel (the parent owns that panel). Selector values
 * are chips tinted by the source block's category. Enums use values_metadata
 * labels. `operations` opens the detections-filter dialog.
 */

import { useEffect, useState } from "react";

import { blockSectionOf, sectionMetaOf } from "../../adapter";
import { setParam } from "../../adapter/mutations";
import { useEditorStore } from "../../state/editorStore";
import { stepsToList } from "../../types/spec";
import type { JsonSchemaProperty } from "../../types/registry";
import type { WorkflowStepSpec } from "../../types/spec";

import { FIELD_CONTROL, FIELD_HINT, FIELD_MENU } from "./nodes/shared";
import { DetectionsFilterModal } from "./DetectionsFilterModal";
import { SelectorPicker } from "./SelectorPicker";
import { SelectModelModal } from "./SelectModelModal";
import { UiIcon, outputFieldIconName } from "./hollowIcons";
import { filterStatusLabel } from "./detectionsFilter";
import {
  displayValue,
  enumLabel,
  enumValues,
  formatStringList,
  isBooleanSchema,
  isNumberSchema,
  isStringListSchema,
  listPlaceholder,
  nudgeNumber,
  parseStringList,
  selectorChipLabel,
  selectorSourceStep,
} from "./fieldModel";
import { sectionChipStyle } from "./sectionChip";

/** Drag payload type used by the side-tray chips and field drop zones. */
export const WF_SELECTOR_DRAG_TYPE = "application/x-wf-selector";

function prettify(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function propertyIcon(property: string, schema: JsonSchemaProperty | undefined): string | null {
  const lower = property.toLowerCase();
  if (lower.includes("image")) {
    return "image";
  }
  if (lower === "model_id" || lower === "model") {
    return "network";
  }
  if (lower.includes("video")) {
    return "video";
  }
  if (lower.includes("prediction")) {
    return "box";
  }
  if (lower.includes("inference_id")) {
    return "id-card";
  }
  if (isStringListSchema(schema)) {
    return "list";
  }
  return null;
}

export function FieldList({
  stepName,
  step,
  keys,
  schemaProperties,
  required,
  selectorProps,
}: {
  stepName: string;
  step: WorkflowStepSpec;
  keys: string[];
  schemaProperties: Record<string, JsonSchemaProperty>;
  required: string[];
  selectorProps: string[];
}) {
  const setStepParam = useEditorStore((state) => state.setStepParam);
  return (
    <div className="workflow-form-fields flex flex-col text-left">
      {keys.map((property) => (
        <FieldRow
          key={property}
          stepName={stepName}
          property={property}
          value={step[property]}
          schema={schemaProperties[property]}
          isRequired={required.includes(property)}
          isSelector={selectorProps.includes(property)}
          onChange={(next) => setStepParam(stepName, property, next)}
        />
      ))}
    </div>
  );
}

function FieldRow({
  stepName,
  property,
  value,
  schema,
  isRequired,
  isSelector,
  onChange,
}: {
  stepName: string;
  property: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  isRequired: boolean;
  isSelector: boolean;
  onChange: (next: unknown) => void;
}) {
  const label = schema?.title ?? prettify(property);
  const description = typeof schema?.description === "string" ? schema.description : undefined;
  const icon = propertyIcon(property, schema);
  const enums = enumValues(schema);
  const boundSelector = typeof value === "string" && value.startsWith("$");
  const isModelId = property === "model_id" || property === "model";
  const isOperations = property === "operations";
  const missingRequired = isRequired && (value === undefined || value === null || value === "") && !isOperations;

  if (isOperations) {
    return (
      <div data-field-name={property} className="mb-4 min-w-0 last:mb-0">
        <OperationsField stepName={stepName} value={value} />
      </div>
    );
  }

  let control: JSX.Element;
  let selectorMissing = false;
  if (isModelId && !boundSelector) {
    control = <ModelField value={typeof value === "string" ? value : ""} required={isRequired} onChange={onChange} />;
  } else if (boundSelector) {
    control = <SelectorChip value={value} onChange={onChange} onDropSelector={onChange} />;
  } else if (enums) {
    control = <EnumField label={label} value={value} schema={schema} options={enums} onChange={onChange} />;
  } else if (isBooleanSchema(schema) || typeof value === "boolean") {
    control = <ToggleField label={label} value={value} schema={schema} onChange={onChange} />;
  } else if (isNumberSchema(schema) || typeof value === "number") {
    control = <NumberField ariaLabel={label} value={value} schema={schema} onChange={onChange} />;
  } else if (isStringListSchema(schema)) {
    control = <StringListField label={label} value={value} schema={schema} onChange={onChange} />;
  } else if (isSelector) {
    selectorMissing = missingRequired;
    control = (
      <SelectorPicker
        property={property}
        stepName={stepName}
        ariaLabel={`${label} selector`}
        onPick={(selector) => onChange(selector)}
      />
    );
  } else if ((typeof value === "object" && value !== null) || schema?.type === "array" || schema?.type === "object") {
    control = <JsonField ariaLabel={label} value={value} onChange={onChange} />;
  } else {
    const current = typeof value === "string" ? value : "";
    const fallback = typeof schema?.default === "string" ? schema.default : "";
    control = (
      <input
        type="text"
        aria-label={label}
        value={current}
        placeholder={fallback || "not set"}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className={FIELD_CONTROL}
      />
    );
  }

  return (
    <div data-field-name={property} className="mb-4 min-w-0 last:mb-0">
      <div className="mb-1.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-gray-600">
            {label}
            {isRequired ? <span className="ml-1 text-pink-700">*</span> : null}
          </label>
          {icon ? <UiIcon name={icon} className="text-xs text-gray-400" /> : null}
          {description ? (
            <span role="tooltip" className="inline-flex cursor-help text-gray-400" title={description}>
              <UiIcon name="help" className="text-xs" />
            </span>
          ) : null}
        </div>
        {description ? <p className={`line-clamp-1 ${FIELD_HINT} text-gray-500`}>{description}</p> : null}
      </div>
      {control}
      {(isModelId && missingRequired) || selectorMissing ? (
        <div className={`mt-1 ${FIELD_HINT} text-pink-700`}>Required input is missing</div>
      ) : null}
    </div>
  );
}

function useDropSelector(onDrop: (selector: string) => void): {
  dropActive: boolean;
  dropProps: {
    onDragOver: (event: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: React.DragEvent) => void;
  };
} {
  const [dropActive, setDropActive] = useState(false);
  return {
    dropActive,
    dropProps: {
      onDragOver: (event) => {
        if (event.dataTransfer.types.includes(WF_SELECTOR_DRAG_TYPE)) {
          event.preventDefault();
          setDropActive(true);
        }
      },
      onDragLeave: () => setDropActive(false),
      onDrop: (event) => {
        event.preventDefault();
        setDropActive(false);
        const selector = event.dataTransfer.getData(WF_SELECTOR_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
        if (selector.startsWith("$")) {
          onDrop(selector);
        }
      },
    },
  };
}

function SelectorChip({
  value,
  onChange,
  onDropSelector,
}: {
  value: string;
  onChange: (next: unknown) => void;
  onDropSelector: (selector: string) => void;
}) {
  const spec = useEditorStore((state) => state.spec);
  const { dropActive, dropProps } = useDropSelector(onDropSelector);
  const source = selectorSourceStep(value);
  const sourceStep = source ? stepsToList(spec?.steps ?? []).find((entry) => entry.name === source) : undefined;
  const section = sourceStep ? blockSectionOf(sourceStep.step.type) : null;
  const meta = section ? sectionMetaOf(section) : null;
  const outputName = value.split(".").pop() ?? value;
  const iconName = outputFieldIconName(outputName);
  return (
    <div
      className={`nodrag inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
        dropActive ? "border-primary" : ""
      }`}
      style={meta ? sectionChipStyle(meta.color) : { backgroundColor: "#F9FAFB", color: "#374151", borderColor: "#E5E7EB" }}
      {...dropProps}
    >
      <UiIcon name={iconName} className="text-xs" />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{selectorChipLabel(value)}</span>
      <button
        type="button"
        aria-label="Clear selector"
        onClick={() => onChange(undefined)}
        className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-black/10"
      >
        <UiIcon name="x" className="text-xs" />
      </button>
    </div>
  );
}

function EnumField({
  label,
  value,
  schema,
  options,
  onChange,
}: {
  label: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  options: string[];
  onChange: (next: unknown) => void;
}) {
  const { dropActive, dropProps } = useDropSelector(onChange);
  const shown = displayValue(value, schema);
  const current = shown === undefined || shown === null ? "" : String(shown);
  const choices = current && !options.includes(current) ? [...options, current] : options;
  return (
    <div
      className={`${FIELD_CONTROL} relative flex items-center ${dropActive ? "border-primary" : ""}`}
      {...dropProps}
    >
      <span className={`min-w-0 flex-1 truncate text-xs ${current ? "text-gray-800" : "text-gray-400"}`}>
        {current ? enumLabel(current, schema) : "not set"}
      </span>
      <button
        type="button"
        aria-label={`Clear ${label}`}
        className="relative z-10 flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-700"
        onClick={() => onChange(undefined)}
      >
        <UiIcon name="x" className="text-xs" />
      </button>
      <UiIcon name="chevron-down" className="pointer-events-none relative z-10 ml-1 text-xs text-gray-400" />
      <select
        aria-label={label}
        value={choices.includes(current) ? current : ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {current === "" ? <option value="">not set</option> : null}
        {choices.map((option) => (
          <option key={option} value={option}>
            {enumLabel(option, schema)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  value,
  schema,
  onChange,
}: {
  label: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  onChange: (next: unknown) => void;
}) {
  const shown = displayValue(value, schema);
  const on = shown === true;
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`nodrag relative h-5 w-9 rounded-full transition-colors ${on ? "bg-primary" : "bg-gray-200"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "left-4" : "left-0.5"}`}
      />
    </button>
  );
}

function ModelField({
  value,
  required,
  onChange,
}: {
  value: string;
  required: boolean;
  onChange: (next: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const empty = !value;
  return (
    <div className="nodrag">
      <button
        type="button"
        aria-label="Select model"
        onClick={() => setOpen(true)}
        className={`${FIELD_MENU} font-normal ${empty && required ? "border-pink-500" : ""}`}
      >
        <span className={`flex-1 truncate ${empty ? "text-gray-400" : "text-gray-800"}`}>
          {empty ? "No Model Selected" : value}
        </span>
        <UiIcon name="edit" className={`ml-1 text-xs ${empty && required ? "text-pink-600" : "text-gray-400"}`} />
      </button>
      {open ? (
        <SelectModelModal
          value={value}
          onClose={() => setOpen(false)}
          onSelect={(modelId) => {
            onChange(modelId);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function OperationsField({ stepName, value }: { stepName: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const mutate = useEditorStore((state) => state.mutate);
  const configured = Array.isArray(value) && value.length > 0;
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700">
          Operations <span className="text-pink-700">*</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-50"
        >
          Configure
        </button>
      </div>
      <p className={`mt-1 ${FIELD_HINT} text-gray-400 ${configured ? "" : "italic"}`}>{filterStatusLabel(value)}</p>
      {open ? (
        <DetectionsFilterModal
          operations={value}
          onClose={() => setOpen(false)}
          onSave={(operations) => {
            mutate((spec) => setParam(spec, stepName, "operations", operations.length > 0 ? operations : undefined));
          }}
        />
      ) : null}
    </div>
  );
}

function NumberField({
  ariaLabel,
  value,
  schema,
  onChange,
}: {
  ariaLabel: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(typeof value === "number" ? String(value) : "");
  useEffect(() => {
    if (typeof value !== "number") {
      setText("");
      return;
    }
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);
  const { dropActive, dropProps } = useDropSelector(onChange);
  const placeholder = typeof schema?.default === "number" ? String(schema.default) : undefined;
  const applyNudge = (direction: 1 | -1) => {
    const next = nudgeNumber(text, schema, direction);
    setText(String(next));
    onChange(next);
  };
  return (
    <div className="nodrag relative" {...dropProps}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) {
            return;
          }
          setText(raw);
          if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            applyNudge(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        className={`${FIELD_CONTROL} pr-6 ${dropActive ? "border-primary" : ""}`}
      />
      <div className="absolute inset-y-px right-1 flex flex-col justify-center text-gray-400">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${ariaLabel}`}
          onClick={() => applyNudge(1)}
          className="nodrag flex h-3 w-3.5 items-center justify-center hover:text-gray-700"
        >
          <UiIcon name="chevron-up" className="text-[10px]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${ariaLabel}`}
          onClick={() => applyNudge(-1)}
          className="nodrag flex h-3 w-3.5 items-center justify-center hover:text-gray-700"
        >
          <UiIcon name="chevron-down" className="text-[10px]" />
        </button>
      </div>
    </div>
  );
}

function StringListField({
  label,
  value,
  schema,
  onChange,
}: {
  label: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  onChange: (next: unknown) => void;
}) {
  const { dropActive, dropProps } = useDropSelector(onChange);
  return (
    <input
      type="text"
      aria-label={label}
      value={formatStringList(value)}
      placeholder={listPlaceholder(schema)}
      {...dropProps}
      onChange={(event) => onChange(parseStringList(event.target.value))}
      className={`${FIELD_CONTROL} ${dropActive ? "border-primary" : ""}`}
    />
  );
}

function JsonField({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(JSON.stringify(value ?? null, null, 2));
    setInvalid(false);
  }, [value]);
  return (
    <textarea
      aria-label={ariaLabel}
      aria-invalid={invalid ? "true" : undefined}
      value={text}
      rows={3}
      spellCheck={false}
      onChange={(event) => {
        setText(event.target.value);
        try {
          onChange(JSON.parse(event.target.value));
          setInvalid(false);
        } catch {
          setInvalid(true);
        }
      }}
      className={`nodrag rounded-md border px-2 py-1 font-mono text-xs text-gray-800 focus:outline-none ${
        invalid ? "border-danger" : "border-gray-300"
      }`}
    />
  );
}
