/**
 * Configure dialog for the Detections Filter block (pattern 2: a required
 * field opens a modal instead of the additional-properties panel).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { UiIcon } from "./hollowIcons";
import {
  EMPTY_FILTER_DRAFT,
  draftFromOperations,
  operationsFromDraft,
  type ClassMode,
  type ConfidenceOp,
  type DetectionsFilterDraft,
} from "./detectionsFilter";

const CONFIDENCE_OPS: { id: ConfidenceOp; label: string }[] = [
  { id: ">=", label: "≥" },
  { id: ">", label: ">" },
  { id: "<=", label: "≤" },
  { id: "<", label: "<" },
  { id: "==", label: "=" },
];

export function DetectionsFilterModal({
  operations,
  onClose,
  onSave,
}: {
  operations: unknown;
  onClose: () => void;
  onSave: (operations: unknown[]) => void;
}) {
  const [draft, setDraft] = useState<DetectionsFilterDraft>(() =>
    Array.isArray(operations) && operations.length > 0 ? draftFromOperations(operations) : { ...EMPTY_FILTER_DRAFT },
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const patch = (partial: Partial<DetectionsFilterDraft>): void => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label="Configure Detections Filtering">
      <div className="fixed inset-0 bg-black/25" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl">
          <div className="flex items-center justify-between gap-3 px-6 py-5">
            <h1 className="m-0 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <UiIcon name="sliders" className="text-lg text-gray-700" />
              Configure Detections Filtering
            </h1>
            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-red-100 hover:text-red-500"
            >
              <UiIcon name="x" className="text-sm" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <label className="mb-1.5 block text-sm font-medium text-gray-800" htmlFor="filter-by">
              Filter By
            </label>
            <div className="relative mb-3">
              <UiIcon name="check" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500" />
              <select
                id="filter-by"
                aria-label="Filter By"
                className="nodrag h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-800"
                defaultValue="class-confidence"
              >
                <option value="class-confidence">Class & Confidence</option>
              </select>
              <UiIcon name="chevron-down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            </div>
            <p className="mb-5 text-sm text-gray-600">Filter detections based on the object class and confidence level.</p>
            <div className="mb-2 text-sm font-medium text-gray-800">
              Filter Detections By <span className="text-pink-600">*</span>
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={draft.classEnabled}
                onChange={(event) => patch({ classEnabled: event.target.checked })}
              />
              Object Class
            </label>
            <div className={`mb-1 flex gap-2 ${draft.classEnabled ? "" : "pointer-events-none opacity-40"}`}>
              <select
                aria-label="Object class mode"
                value={draft.classMode}
                onChange={(event) => patch({ classMode: event.target.value as ClassMode })}
                className="nodrag h-10 w-28 shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-sm"
              >
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </select>
              <input
                type="text"
                aria-label="Object classes"
                placeholder="Enter Object Classes"
                value={draft.classesText}
                onChange={(event) => patch({ classesText: event.target.value })}
                className="nodrag h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </div>
            <p className="mb-4 text-xs text-gray-500">Enter object classes separated by a comma.</p>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={draft.confidenceEnabled}
                onChange={(event) => patch({ confidenceEnabled: event.target.checked })}
              />
              Confidence
            </label>
            <div className={`flex gap-2 ${draft.confidenceEnabled ? "" : "pointer-events-none opacity-40"}`}>
              <select
                aria-label="Confidence comparator"
                value={draft.confidenceOp}
                onChange={(event) => patch({ confidenceOp: event.target.value as ConfidenceOp })}
                className="nodrag h-10 w-16 shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-sm"
              >
                {CONFIDENCE_OPS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Confidence threshold"
                step="0.1"
                value={draft.confidenceText}
                onChange={(event) => patch({ confidenceText: event.target.value })}
                className="nodrag h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end px-6 py-4">
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
              onClick={() => {
                onSave(operationsFromDraft(draft));
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
