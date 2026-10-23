/** Shared node-card shell, handles and tiny icons (13-ui-style-spec.md). */

import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";

export const IO_ACCENT = "#E5E7EB";

/**
 * Single-line controls on Inputs, Outputs, and step nodes.
 * 32px, 8px radius, gray-300 border, purple focus. Step accent is a 4px
 * border-left; content sits 16px to the right of that bar (pl-4).
 */
export const FIELD_CONTROL =
  "nodrag h-8 min-h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 outline-none placeholder:text-gray-400 focus:border-purple-500 focus:outline-none";

export const FIELD_MENU =
  "nodrag flex h-8 min-h-8 w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 text-left text-xs font-medium text-gray-700 outline-none transition-colors hover:border-gray-400 hover:bg-gray-50";

/**
 * Full-width node actions. Select Image, Add Input, Add Output, and
 * Show Additional Properties must share this class; do not restyle one of them.
 */
/**
 * Hint copy on a block: field descriptions and validation lines.
 * One size for all of them; only the color changes.
 */
export const FIELD_HINT = "text-[11px] leading-relaxed";

export const FIELD_ACTION =
  "nodrag flex h-8 min-h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-gray-400 hover:bg-gray-50";

export function NodeShell({
  accent,
  selected,
  dimmed,
  danger,
  error,
  children,
}: {
  accent: string;
  selected: boolean;
  dimmed?: boolean;
  danger?: boolean;
  /** First validation error for this node; renders the red dot with its title. */
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-[280px] rounded-r-md bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]"
      style={{
        borderWidth: selected ? 1.5 : 1,
        borderStyle: "solid",
        borderColor: danger ? "#DC2626" : selected ? "#6D28D9" : "#E5E7EB",
        borderLeftWidth: 4,
        borderLeftColor: accent,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {error ? (
        <span
          aria-label="Node validation error"
          title={error}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold leading-none text-white shadow"
        >
          !
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Node-level handles, matching the cloud builder: every consuming node has ONE
 * target handle at its top edge, every producing node ONE source handle at its
 * bottom edge. Multiple references converge on the same top handle.
 */
export function TopTargetHandle() {
  return <Handle type="target" position={Position.Top} id="in" className="wf-handle" style={{ top: -10 }} />;
}

export function BottomSourceHandle() {
  return <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" style={{ bottom: -10 }} />;
}
