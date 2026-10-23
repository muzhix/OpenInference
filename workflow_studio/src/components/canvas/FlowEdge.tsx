/**
 * Vertical connection: a gray flowing dash, and on hover the insert / remove /
 * impact controls that sit on the line.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BaseEdge, EdgeLabelRenderer, getStraightPath, useReactFlow, type EdgeProps } from "@xyflow/react";

import { STEP_CARD_HEIGHT, disconnectConnection, insertSlotGeometry } from "../../adapter";
import type { AppEdge } from "../../adapter";
import { useEditorStore } from "../../state/editorStore";
import { UiIcon } from "./hollowIcons";
import {
  INSERT_PLACEHOLDER_ID,
  clearedFields,
  clearedFieldsTip,
  confirmClearMessage,
  removalWarning,
} from "./flowEdges";

export function FlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  style,
}: EdgeProps<AppEdge>) {
  const { getNodes } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  useEffect(() => () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
  }, []);

  const bindings = data?.bindings ?? [];
  const fields = clearedFields(bindings);
  const inert = data?.inert === true || fields.length === 0;
  const dangling = style?.stroke === "#DC2626";
  const showControls = !inert && (hovered || confirming);

  const reveal = (): void => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setHovered(true);
  };

  const scheduleHide = (): void => {
    if (confirmingRef.current) {
      return;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => setHovered(false), 220);
  };

  const insertBlock = (): void => {
    const store = useEditorStore.getState();
    const nodes = getNodes();
    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);
    if (!sourceNode || !targetNode) {
      return;
    }
    const sourcePos = store.livePositions[source] ?? sourceNode.position;
    const targetPos = store.livePositions[target] ?? targetNode.position;
    const geo = insertSlotGeometry(
      { x: sourcePos.x, y: sourcePos.y, height: sourceNode.measured?.height ?? STEP_CARD_HEIGHT },
      targetPos.y,
    );
    const shiftedPositions: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) {
      if (node.id === INSERT_PLACEHOLDER_ID) {
        continue;
      }
      const pos = store.livePositions[node.id] ?? node.position;
      shiftedPositions[node.id] = node.id !== source && pos.y >= geo.minY
        ? { x: pos.x, y: pos.y + geo.dy }
        : { x: pos.x, y: pos.y };
    }
    store.beginInsert({
      sourceId: source,
      targetId: target,
      position: { x: geo.x, y: geo.y },
      shiftedPositions,
    });
  };

  const confirmRemove = (): void => {
    useEditorStore.getState().mutate((spec) => disconnectConnection(spec, { source, target, data }));
    confirmingRef.current = false;
    setConfirming(false);
  };

  return (
    <>
      <g onMouseEnter={reveal} onMouseLeave={scheduleHide}>
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          interactionWidth={36}
          className={dangling ? "wf-flow wf-flow-dangling" : "wf-flow"}
          style={style}
        />
      </g>
      {showControls ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              zIndex: 20,
            }}
            onMouseEnter={reveal}
            onMouseLeave={scheduleHide}
          >
            {confirming ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 shadow-md">
                <UiIcon name="alert" className="shrink-0 text-base text-red-500" />
                <p className="whitespace-nowrap text-sm text-red-800">{confirmClearMessage(fields.length, target)}</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmingRef.current = false;
                    setConfirming(false);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-label="Confirm remove connection"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmRemove();
                  }}
                  className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <EdgeButton
                  label="Insert Block"
                  tip="Insert Block"
                  className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                  onClick={insertBlock}
                >
                  <UiIcon name="plus" className="text-xs" />
                </EdgeButton>
                <EdgeButton
                  label="Remove connection"
                  tip={removalWarning(fields, target)}
                  className="bg-[#F43F5E] text-white hover:bg-[#E11D48]"
                  onClick={() => {
                    confirmingRef.current = true;
                    setConfirming(true);
                  }}
                >
                  <UiIcon name="x" className="text-xs" />
                </EdgeButton>
                <EdgeButton
                  label={clearedFieldsTip(fields)}
                  tip={clearedFieldsTip(fields)}
                  className="bg-[#FDE2E8] text-[11px] font-semibold text-[#E11D48]"
                  onClick={() => undefined}
                >
                  {fields.length}
                </EdgeButton>
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function EdgeButton({
  label,
  tip,
  className,
  onClick,
  children,
}: {
  label: string;
  tip: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${className}`}
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white shadow-lg"
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
