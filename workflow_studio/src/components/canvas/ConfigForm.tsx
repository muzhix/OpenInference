/** Schema-driven inline config form (double-click expanded; 03 §3, cloud visibility rules). */

import { useEffect, useState } from "react";

import { SelectorInput } from "./SelectorInput";
import { splitFormFields } from "./formFields";
import { useEditorStore } from "../../state/editorStore";

import type { JsonSchemaProperty } from "../../types/registry";
import type { WorkflowStepSpec } from "../../types/spec";

function prettify(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  const renameStepNode = useEditorStore((state) => state.renameStepNode);
  const [showAdditional, setShowAdditional] = useState(false);

  const { primary, additional } = splitFormFields(schemaProperties, required, step, selectorProps);

  return (
    <div className="workflow-form-fields flex flex-col gap-2.5 border-t border-gray-100 pt-2 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Name</span>
        <input
          type="text"
          aria-label="Step name"
          defaultValue={stepName}
          key={stepName}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== stepName) {
              renameStepNode(stepName, next);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-primary"
        />
      </label>

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
        <button
          type="button"
          aria-label="Show additional properties"
          onClick={() => setShowAdditional(!showAdditional)}
          className="self-start text-[11px] font-medium text-primary hover:underline"
        >
          {showAdditional ? "Hide Additional Properties" : "Show Additional Properties"}
        </button>
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

  let control: JSX.Element;
  if (isSelector && (typeof value === "string" || value === undefined)) {
    control = (
      <SelectorInput
        value={typeof value === "string" ? value : ""}
        onChange={(next) => onChange(next === "" ? undefined : next)}
        ariaLabel={`${label} selector`}
      />
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
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-primary"
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
      <label className="flex items-center gap-2 text-xs text-gray-700">
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
    control = (
      <NumberField ariaLabel={label} value={typeof value === "number" ? value : undefined} onChange={onChange} />
    );
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
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-primary"
      />
    ) : (
      <input
        type="text"
        aria-label={label}
        value={asString}
        placeholder="not set"
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-primary"
      />
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">
        {label}
        {isRequired ? <span title="Required" className="text-danger">*</span> : null}
      </span>
      {description ? (
        <span className="text-[10px] leading-3 text-gray-400">{description}</span>
      ) : null}
      {control}
    </label>
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
      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-primary"
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
      className={`rounded-md border px-2 py-1 font-mono text-xs text-gray-800 focus:outline-primary ${
        invalid ? "border-danger" : "border-gray-300"
      }`}
    />
  );
}
