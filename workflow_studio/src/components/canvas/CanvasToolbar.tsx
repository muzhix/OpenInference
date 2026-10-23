/**
 * Floating canvas toolbar mirroring the official builder's bottom bar
 * (observed 2026-10-22): rounded-xl white pill, h-7 icon buttons with dark
 * floating tooltips above them, and the auto-layout group whose chevron
 * opens the "Arrange now / Arrange automatically" popover. The add-block
 * entry (black circular +) lives in WorkflowCanvas, not here.
 */

import { useEffect, useRef, useState } from "react";

import { useReactFlow } from "@xyflow/react";

import { computeAutoLayout, graphNodeIds } from "../../adapter";
import { UiIcon } from "./hollowIcons";
import { useEditorStore } from "../../state/editorStore";
import type { ReactNode } from "react";

const TOOL_BUTTON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-primary";

function ToolButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled ? "true" : undefined}
        onClick={() => {
          if (!disabled) {
            onClick();
          }
        }}
        className={className ? `${TOOL_BUTTON_CLASS} ${className}` : TOOL_BUTTON_CLASS}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-gray-200" />;
}

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  const applyLayout = useEditorStore((state) => state.applyLayout);
  const locked = useEditorStore((state) => state.canvasLocked);
  const setCanvasLocked = useEditorStore((state) => state.setCanvasLocked);
  const minimapVisible = useEditorStore((state) => state.minimapVisible);
  const toggleMinimap = useEditorStore((state) => state.toggleMinimap);
  const autoArrange = useEditorStore((state) => state.autoArrange);
  const toggleAutoArrange = useEditorStore((state) => state.toggleAutoArrange);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);

  const runAutoLayout = () => {
    const spec = useEditorStore.getState().spec;
    if (!spec) {
      return;
    }
    applyLayout(computeAutoLayout(spec, graphNodeIds(spec)));
  };

  // Close the arrange popover on outside clicks, like the official menu.
  useEffect(() => {
    if (!optionsOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [optionsOpen]);

  return (
    <div
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm"
      role="toolbar"
      aria-label="Canvas tools"
    >
      <ToolButton label="Undo" onClick={undo} disabled={!canUndo}>
        <UiIcon name="undo" className="text-base" />
      </ToolButton>
      <ToolButton label="Redo" onClick={redo} disabled={!canRedo}>
        <UiIcon name="redo" className="text-base" />
      </ToolButton>
      <Separator />
      <div className="relative flex items-center" ref={optionsRef}>
        <ToolButton
          label={autoArrange ? "Auto layout (automatic)" : "Auto layout (manual)"}
          onClick={runAutoLayout}
        >
          <UiIcon name="sitemap" className="text-base" />
        </ToolButton>
        <ToolButton
          label="Auto layout options"
          className="w-4"
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <UiIcon name="chevron-up" className="text-xs" />
        </ToolButton>
        {optionsOpen ? (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-100"
              onClick={() => {
                runAutoLayout();
                setOptionsOpen(false);
              }}
            >
              <UiIcon name="sitemap" className="text-sm text-gray-400" />
              Arrange now
            </button>
            <div className="flex items-center justify-between rounded-md px-2 py-1.5">
              <span className="text-xs font-medium text-gray-700">Arrange automatically</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoArrange}
                aria-label="Arrange automatically"
                onClick={toggleAutoArrange}
                className={`flex h-3 w-6 items-center rounded-full transition-colors ${
                  autoArrange ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
                    autoArrange ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="px-2 pb-1.5 text-[11px] leading-snug text-gray-500">
              Re-arranges when blocks are added. Dragging a block pauses it.
            </p>
          </div>
        ) : null}
      </div>
      <Separator />
      <ToolButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })}>
        <UiIcon name="minus" className="text-base" />
      </ToolButton>
      <ToolButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })}>
        <UiIcon name="plus" className="text-base" />
      </ToolButton>
      <Separator />
      <ToolButton
        label={locked ? "Unlock interactions" : "Lock interactions"}
        onClick={() => setCanvasLocked(!locked)}
      >
        <UiIcon name={locked ? "lock" : "lock-open"} className="text-base" />
      </ToolButton>
      <Separator />
      <ToolButton label="Fit view" onClick={() => fitView({ duration: 200, padding: 0.2 })}>
        <UiIcon name="expand" className="text-base" />
      </ToolButton>
      <ToolButton
        label={minimapVisible ? "Hide minimap" : "Show minimap"}
        onClick={toggleMinimap}
      >
        <UiIcon name="map" className="text-base" />
      </ToolButton>
    </div>
  );
}
