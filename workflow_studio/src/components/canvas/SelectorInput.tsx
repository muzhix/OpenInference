/** Selector input: text field with syntax check + drag target + output-badge tray (03 §4, B6). */

import { useMemo, useState } from "react";

import { useEditorStore } from "../../state/editorStore";
import { useRegistryStore } from "../../state/registryStore";
import { isValidSelectorSyntax } from "../../adapter";

import type { WorkflowSpecification } from "../../types/spec";
import { stepsToList } from "../../types/spec";

export interface SelectorBadge {
  label: string;
  selector: string;
  isInput: boolean;
}

export function collectSelectorBadges(spec: WorkflowSpecification | null, registry: ReturnType<typeof useRegistryStore.getState>["registry"]): SelectorBadge[] {
  if (!spec) {
    return [];
  }
  const badges: SelectorBadge[] = [];
  for (const input of spec.inputs ?? []) {
    badges.push({ label: input.name, selector: `$inputs.${input.name}`, isInput: true });
  }
  for (const { name, step } of stepsToList(spec.steps)) {
    const outputs = registry?.blocks.find((block) => block.manifest_type_identifier === step.type)?.outputs_manifest;
    const outputNames = outputs && outputs.length > 0 ? outputs.map((output) => output.name) : ["*"];
    for (const outputName of outputNames) {
      badges.push({
        label: outputName === "*" ? `${name}` : `${name} → ${outputName}`,
        selector: outputName === "*" ? `$steps.${name}` : `$steps.${name}.${outputName}`,
        isInput: false,
      });
    }
  }
  return badges;
}

export function SelectorInput({
  value,
  onChange,
  placeholder = "$inputs.image",
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);
  const badges = useMemo(() => collectSelectorBadges(spec, registry), [spec, registry]);
  const invalid = value.trim().length > 0 && !isValidSelectorSyntax(value);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        aria-label={ariaLabel}
        aria-invalid={invalid ? "true" : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          const dropped = event.dataTransfer.getData("text/plain");
          if (dropped) {
            onChange(dropped);
          }
        }}
        className={`w-full rounded-md border px-2 py-1 font-mono text-xs text-gray-800 focus:outline-none ${
          invalid || dropActive ? "border-danger" : "border-gray-300"
        } ${dropActive ? "bg-primary-50" : "bg-white"}`}
        spellCheck={false}
      />
      {focused && badges.length > 0 ? (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
          aria-label="Selector tray"
        >
          <p className="mb-1 px-1 text-[11px] text-gray-500">
            {badges.length} outputs · drag to bind
          </p>
          <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
            {badges.map((badge) => (
              <button
                key={badge.selector}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", badge.selector);
                }}
                onClick={() => onChange(badge.selector)}
                title={badge.selector}
                aria-label={`Insert selector ${badge.selector}`}
                className="cursor-grab rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-700 hover:border-primary hover:bg-primary-50"
              >
                {badge.isInput ? <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-gray-900 align-middle" /> : null}
                {badge.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
