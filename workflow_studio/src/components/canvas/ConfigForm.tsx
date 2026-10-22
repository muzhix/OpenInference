/**
 * Schema-driven inline config form (expanded node), mirroring the official
 * builder's field rows: label + kind icon + "?" + one-line description above
 * the control; selector values render as chips (drop targets for the side
 * tray's drag-to-connect); model_id opens the Select-a-Model modal; optional
 * fields wait behind the bordered "Show Additional Properties" toggle.
 */

import { useEffect, useState } from "react";

import { faClasses } from "../../adapter";
import { UiIcon } from "./hollowIcons";
import { SelectorPicker } from "./SelectorPicker";
import { SelectModelModal } from "./SelectModelModal";
import { splitFormFields } from "./formFields";
import { useEditorStore } from "../../state/editorStore";

import type { JsonSchemaProperty } from "../../types/registry";
import type { WorkflowStepSpec } from "../../types/spec";

/** Drag payload type used by the side-tray chips and field drop zones. */
export const WF_SELECTOR_DRAG_TYPE = "application/x-wf-selector";

function prettify(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Small kind hint icon shown next to the label (heuristic, official uses kinds). */
function labelIcon(property: string): string | null {
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
  return null;
}

export function ConfigForm({
  stepName,
  step,
  schemaProperties,
  required,
  selectorProps,
}: {
  stepName: string;
  step: WorkflowStepSpec;
  schemaProperties: Record<string, JsonSchemaProperty>;
  required: string[];
  selectorProps: string[];
}) {
  const setStepParam = useEditorStore((state) => state.setStepParam);
  const [showAdditional, setShowAdditional] = useState(false);

  const { primary, additional } = splitFormFields(schemaProperties, required, step, selectorProps);

  return (
    <div className="workflow-form-fields flex flex-col gap-2.5 text-left">
      {(showAdditional ? [...primary, ...additional] : primary).map((property) => (
        <FieldRow
          key={property}
          property={property}
          value={step[property]}
          schema={schemaProperties[property]}
          isRequired={required.includes(property)}
          isSelector={
            selectorProps.includes(property) ||
            (typeof step[property] === "string" && String(step[property]).startsWith("$"))
          }
          onChange={(next) => setStepParam(stepName, property, next)}
        />
      ))}

      {additional.length > 0 ? (
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            aria-label="Show additional properties"
            onClick={() => setShowAdditional(!showAdditional)}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <UiIcon name="chevron-left" className={`text-sm transition-transform ${showAdditional ? "-rotate-90" : ""}`} />
            <span>{showAdditional ? "Hide Additional Properties" : "Show Additional Properties"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  property,
  value,
  schema,
  isRequired,
  isSelector,
  onChange,
}: {
  property: string;
  value: unknown;
  schema?: JsonSchemaProperty;
  isRequired: boolean;
  isSelector: boolean;
  onChange: (next: unknown) => void;
}) {
  const label = schema?.title ?? prettify(property);
  const description = typeof schema?.description === "string" ? schema.description : undefined;
  const missingRequired = isRequired && (value === undefined || value === null || value === "");
  const icon = labelIcon(property);
  const [dropActive, setDropActive] = useState(false);

  const onDropSelector = (event: React.DragEvent): void => {
    event.preventDefault();
    setDropActive(false);
    const selector = event.dataTransfer.getData(WF_SELECTOR_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    if (selector.startsWith("$")) {
      onChange(selector);
    }
  };

  let control: JSX.Element;
  const isModelId = property === "model_id" || property === "model";
  if (isModelId) {
    control = <ModelField value={typeof value === "string" ? value : ""} required={isRequired} onChange={onChange} />;
  } else if (isSelector && (typeof value === "string" || value === undefined)) {
    const text = typeof value === "string" ? value : "";
    control = text ? (
      <div
        className={`nodrag drop-zone-base inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          dropActive ? "border-primary bg-primary-50" : "border-gray-200 bg-gray-50 text-gray-700"
        }`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(WF_SELECTOR_DRAG_TYPE)) {
            event.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDropSelector}
      >
        {icon ? <UiIcon name={icon} className="text-[10px] text-gray-400" /> : null}
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{text.replace(/^\$/, "")}</span>
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={() => onChange(undefined)}
          className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-current hover:bg-black/10"
        >
          <UiIcon name="x" className="text-[10px]" />
        </button>
      </div>
    ) : (
      <div
        className={`nodrag drop-zone-base rounded-lg border-2 border-dashed transition-colors ${
          dropActive ? "border-primary bg-primary-50" : "border-transparent"
        }`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(WF_SELECTOR_DRAG_TYPE)) {
            event.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDropSelector}
      >
        <SelectorPicker
          property={property}
          ariaLabel={`${label} selector`}
          onPick={(selector) => onChange(selector)}
        />
      </div>
    );
  } else if (Array.isArray(schema?.enum)) {
    const options = schema.enum.map((option) => String(option));
    const current = value === undefined ? "" : String(value);
    if (current && !options.includes(current)) {
      options.push(current);
    }
    control = (
      <select
        aria-label={label}
        value={current}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="nodrag h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
      >
        <option value="">not set</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (schema?.type === "boolean" || typeof value === "boolean") {
    control = (
      <label className="nodrag flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          aria-label={label}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        {value === true ? "enabled" : "disabled"}
      </label>
    );
  } else if (
    schema?.type === "integer" ||
    schema?.type === "number" ||
    (Array.isArray(schema?.type) && (schema.type as string[]).some((t) => t === "number" || t === "integer")) ||
    typeof value === "number"
  ) {
    control = <NumberField ariaLabel={label} value={typeof value === "number" ? value : undefined} onChange={onChange} />;
  } else if (
    (typeof value === "object" && value !== null) ||
    schema?.type === "array" ||
    schema?.type === "object"
  ) {
    control = <JsonField ariaLabel={label} value={value} onChange={onChange} />;
  } else {
    const asString = typeof value === "string" ? value : "";
    const long = asString.length > 80;
    control = long ? (
      <textarea
        aria-label={label}
        value={asString}
        rows={3}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="nodrag rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
      />
    ) : (
      <input
        type="text"
        aria-label={label}
        value={asString}
        placeholder="not set"
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="nodrag h-8 w-full rounded-md border border-gray-300 px-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
      />
    );
  }

  return (
    <div data-field-name={property} className="mb-4 min-w-0 last:mb-0">
      <div className="mb-1.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-gray-600">
            {label}
            {isRequired ? <span className="ml-1 text-pink-800">*</span> : null}
          </label>
          {icon ? <UiIcon name={icon} className="text-[10px] text-gray-400" /> : null}
          {description ? (
            <span className="cursor-help text-xs text-gray-400" title={description}>
              <UiIcon name="help" className="text-sm" />
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="line-clamp-1 text-[11px] leading-relaxed text-gray-500">{description}</p>
        ) : null}
      </div>
      {control}
      {isModelId && missingRequired ? (
        <div className="mt-1 text-[11px] text-pink-800">Required input is missing</div>
      ) : null}
    </div>
  );
}

/** Model identifier field: opens the Select-a-Model modal (official behavior). */
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
    <div className="nodrag drop-zone-base">
      <button
        type="button"
        aria-label="Select model"
        onClick={() => setOpen(true)}
        className={`flex h-8 w-full cursor-pointer items-center justify-between rounded-lg border px-2.5 text-left text-xs transition-colors hover:border-gray-400 hover:bg-gray-50 ${
          empty && required ? "border-pink-500 bg-white" : "border-gray-300 bg-white"
        }`}
      >
        <span className={`flex-1 truncate ${empty ? "text-gray-400" : "text-gray-800"}`}>
          {empty ? "No Model Selected" : value}
        </span>
        <UiIcon name="edit" className={`ml-1 text-xs ${empty && required ? "text-pink-700" : "text-gray-400"}`} />
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

function NumberField({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: number | undefined;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value]);
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        if (event.target.value === "") {
          onChange(undefined);
          return;
        }
        const parsed = Number(event.target.value);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      className="nodrag h-8 w-full rounded-md border border-gray-300 px-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
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
