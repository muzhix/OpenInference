/**
 * Source picker for unbound selector fields. A "Select image"-style button
 * opens a grouped popover of sources whose kind can feed the field: workflow
 * inputs first, then other steps' compatible outputs. An image field only
 * offers image inputs and image outputs, so a detection model's
 * inference_id / predictions / model_id stay out of that list.
 */

import { useMemo, useState } from "react";

import { blockSectionOf, faClasses, sectionMetaOf } from "../../adapter";
import { acceptedKindsForProperty, kindsMatch } from "../../adapter/registryUtils";
import { UiIcon, inputTypeIconName } from "./hollowIcons";
import { FIELD_ACTION } from "./nodes/shared";
import { useEditorStore } from "../../state/editorStore";
import { useRegistryStore } from "../../state/registryStore";
import type { BlockRegistry, OutputManifestEntry } from "../../types/registry";
import { inputKindName, stepsToList } from "../../types/spec";
import type { WorkflowSpecification } from "../../types/spec";

export function pickerButtonLabel(property: string): string {
  const lower = property.toLowerCase();
  if (lower.includes("image")) {
    return "Select Image";
  }
  if (lower.includes("video")) {
    return "Select Video";
  }
  return "Select Source";
}

interface SelectorGroup {
  title: string;
  /** Inputs node uses its arrow icon; a step uses its registry block icon. */
  header: "inputs" | "block";
  faIcon?: string;
  rows: SourceRow[];
}

interface SourceRow {
  selector: string;
  label: string;
  /** "input" renders the input-type hollow icon; "block" renders the registry FA icon. */
  iconType: "input" | "block";
  inputType?: string;
  faIcon?: string;
  tint?: string;
  color?: string;
}

function fieldAccepts(accepted: string[], sourceKinds: string[]): boolean {
  if (accepted.length === 0) {
    return true;
  }
  if (sourceKinds.length === 0) {
    return false;
  }
  return sourceKinds.some((kind) => accepted.some((required) => kindsMatch(required, kind)));
}

function outputKinds(output: OutputManifestEntry): string[] {
  return output.kind.map((kind) => kind.name).filter((name) => name.length > 0);
}

/**
 * Sources that can feed `property` on `stepName`. The step's own outputs are
 * omitted. When the registry names the field's kinds, only matching sources
 * are listed; an image-named field still filters to image when that matrix
 * row is missing.
 */
export function buildSelectorGroups(
  spec: WorkflowSpecification | null | undefined,
  registry: BlockRegistry | null | undefined,
  property: string,
  stepName: string,
): SelectorGroup[] {
  const blocksByType = new Map((registry?.blocks ?? []).map((block) => [block.manifest_type_identifier, block]));
  const stepType = stepsToList(spec?.steps ?? []).find((entry) => entry.name === stepName)?.step.type;
  const declared = stepType ? acceptedKindsForProperty(registry, stepType, property) : [];
  const accepted = declared.length > 0 || !property.toLowerCase().includes("image") ? declared : ["image"];
  const result: SelectorGroup[] = [];

  const inputRows: SourceRow[] = [];
  for (const input of spec?.inputs ?? []) {
    const kind = inputKindName(input.type);
    if (!fieldAccepts(accepted, kind ? [kind] : [])) {
      continue;
    }
    inputRows.push({
      selector: `$inputs.${input.name}`,
      label: input.name,
      iconType: "input",
      inputType: input.type,
    });
  }
  if (inputRows.length > 0) {
    result.push({ title: "inputs", header: "inputs", rows: inputRows });
  }

  for (const { name, step } of stepsToList(spec?.steps ?? [])) {
    if (name === stepName) {
      continue;
    }
    const block = blocksByType.get(step.type);
    const meta = sectionMetaOf(blockSectionOf(step.type));
    const outputs = block?.outputs_manifest ?? [];
    const listed = outputs.length > 0 ? outputs : [{ name: "*", kind: [] }];
    const rows: SourceRow[] = [];
    for (const output of listed) {
      if (!fieldAccepts(accepted, outputKinds(output))) {
        continue;
      }
      rows.push({
        selector: output.name === "*" ? `$steps.${name}` : `$steps.${name}.${output.name}`,
        label: output.name,
        iconType: "block",
        faIcon: block?.block_schema?.ui_manifest?.icon ?? "far fa-cube",
        tint: meta.tint,
        color: meta.color,
      });
    }
    if (rows.length > 0) {
      result.push({
        title: name,
        header: "block",
        faIcon: block?.block_schema?.ui_manifest?.icon ?? "far fa-cube",
        rows,
      });
    }
  }
  return result;
}

export function SelectorPicker({
  property,
  stepName,
  ariaLabel,
  onPick,
}: {
  property: string;
  stepName: string;
  ariaLabel: string;
  onPick: (selector: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);

  const groups = useMemo(
    () => buildSelectorGroups(spec, registry, property, stepName),
    [spec, registry, property, stepName],
  );

  return (
    <div className="nodrag relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={FIELD_ACTION}
      >
        <UiIcon name="plus" className="text-xs" />
        <span>{pickerButtonLabel(property)}</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {groups.map((group) => (
            <div key={group.title} className="py-1">
              <div className="flex items-center gap-2 px-2 py-1 text-left text-gray-700">
                {group.header === "inputs" ? (
                  <UiIcon name="arrow-down-to-line" className="text-xs" />
                ) : (
                  <i className={`${faClasses(group.faIcon ?? "far fa-cube")} text-xs`} aria-hidden="true" />
                )}
                <span className="text-xs font-medium">{group.title}</span>
              </div>
              <div className="flex flex-wrap gap-1 px-2 pb-1">
                {group.rows.map((row) => (
                  <button
                    key={row.selector}
                    type="button"
                    title={row.selector}
                    onClick={() => {
                      onPick(row.selector);
                      setOpen(false);
                    }}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:border-gray-300 hover:bg-gray-50"
                    style={
                      row.tint && row.color
                        ? { backgroundColor: row.tint, color: row.color, borderColor: row.tint }
                        : { backgroundColor: "#F9FAFB", color: "#374151", borderColor: "#E5E7EB" }
                    }
                  >
                    {row.iconType === "input" ? (
                      <UiIcon name={inputTypeIconName(row.inputType ?? "WorkflowImage")} className="text-xs" />
                    ) : (
                      <i className={`${faClasses(row.faIcon ?? "far fa-cube")} text-xs`} aria-hidden="true" />
                    )}
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{row.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
