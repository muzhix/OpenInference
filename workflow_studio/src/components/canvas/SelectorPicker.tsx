/**
 * Source picker for unbound selector fields (official behavior): a
 * "Select image"-style button opens a grouped popover listing every available
 * source — workflow inputs first, then each step's outputs — and picking a row
 * binds the field's selector. Mirrors the official image-source dropdown.
 */

import { useMemo, useState } from "react";

import { blockSectionOf, faClasses, sectionMetaOf } from "../../adapter";
import { UiIcon, inputTypeIconName } from "./hollowIcons";
import { useEditorStore } from "../../state/editorStore";
import { useRegistryStore } from "../../state/registryStore";
import { stepsToList } from "../../types/spec";
import { inputTypeIcon } from "./nodes/NodeChrome";

export function pickerButtonLabel(property: string): string {
  const lower = property.toLowerCase();
  if (lower.includes("image")) {
    return "Select image";
  }
  if (lower.includes("video")) {
    return "Select video";
  }
  return "Select source";
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

export function SelectorPicker({
  property,
  ariaLabel,
  onPick,
}: {
  property: string;
  ariaLabel: string;
  onPick: (selector: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);

  const groups = useMemo(() => {
    const blocksByType = new Map((registry?.blocks ?? []).map((block) => [block.manifest_type_identifier, block]));
    const result: { title: string; rows: SourceRow[] }[] = [];
    result.push({
      title: "inputs",
      rows: (spec?.inputs ?? []).map((input) => ({
        selector: `$inputs.${input.name}`,
        label: input.name,
        iconType: "input" as const,
        inputType: input.type,
      })),
    });
    for (const { name, step } of stepsToList(spec?.steps ?? [])) {
      const block = blocksByType.get(step.type);
      const meta = sectionMetaOf(blockSectionOf(step.type));
      const outputs = (block?.outputs_manifest ?? []).map((output) => output.name);
      const listed = outputs.length > 0 ? outputs : ["*"];
      result.push({
        title: name,
        rows: listed.map((output) => ({
          selector: output === "*" ? `$steps.${name}` : `$steps.${name}.${output}`,
          label: output,
          iconType: "block" as const,
          faIcon: block?.block_schema?.ui_manifest?.icon ?? "far fa-cube",
          tint: meta.tint,
          color: meta.color,
        })),
      });
    }
    return result;
  }, [spec, registry]);

  return (
    <div className="nodrag relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 text-left text-xs transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        <span className="flex-1 truncate text-gray-400">{pickerButtonLabel(property)}</span>
        <UiIcon name="chevron-down" className="text-sm text-gray-400" />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {groups.map((group) => (
            <div key={group.title} className="py-1">
              <div className="flex items-center gap-2 px-2 py-1 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group.title}</span>
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
