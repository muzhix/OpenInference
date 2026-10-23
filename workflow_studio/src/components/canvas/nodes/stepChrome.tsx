/**
 * Shared step-node chrome: the left-hand Additional Properties panel and the
 * "Powered by" footer. Header, accent, and the form stay in WorkflowStepNode
 * / ConfigForm so each block only supplies schema.
 */

import type { ReactNode } from "react";

import { UiIcon } from "../hollowIcons";
import { FIELD_ACTION } from "./shared";
import type { PoweredBy } from "../fieldModel";

export function AdditionalPropertiesPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      data-node-overlay
      className="nodrag nowheel absolute right-full top-0 z-30 mr-3 flex max-h-[560px] w-[300px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-lg"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="text-sm font-semibold text-gray-900">Additional Properties</div>
        <button
          type="button"
          aria-label="Hide additional properties"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <UiIcon name="x" className="text-sm" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

export function PoweredByFooter({ poweredBy }: { poweredBy: PoweredBy }) {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 text-[10px] text-gray-500">
      <div>
        <span>Powered by</span>
        <span> </span>
        <a href={poweredBy.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
          {poweredBy.label}
        </a>
        <i className="fa-brands fa-github ml-0.5 text-black" aria-hidden="true" />
      </div>
    </div>
  );
}

export function AdditionalPropertiesButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Hide additional properties" : "Show additional properties"}
        onClick={onToggle}
        className={FIELD_ACTION}
      >
        <UiIcon name={open ? "chevron-right" : "chevron-left"} className="text-sm text-gray-500" />
        <span>{open ? "Hide Additional Properties" : "Show Additional Properties"}</span>
      </button>
    </div>
  );
}
