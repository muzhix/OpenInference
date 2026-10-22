/** Floating canvas toolbar: undo/redo/auto-layout/zoom/fit/lock/minimap (B7).
 * The add-block entry is the black circular + pinned to the canvas (official
 * builder); it lives in WorkflowCanvas, not here. */

import { useReactFlow } from "@xyflow/react";

import { computeAutoLayout, graphNodeIds } from "../../adapter";
import { useEditorStore } from "../../state/editorStore";
import { IconButton } from "../ui/Button";
import {
  FitViewIcon,
  LayoutIcon,
  LockIcon,
  MapIcon,
  RedoIcon,
  UndoIcon,
  UnlockIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";

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

  const runAutoLayout = () => {
    const spec = useEditorStore.getState().spec;
    if (!spec) {
      return;
    }
    applyLayout(computeAutoLayout(spec, graphNodeIds(spec)));
  };

  return (
    <div
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
      role="toolbar"
      aria-label="Canvas tools"
    >
      <IconButton label="Undo" disabled={!canUndo} disabledReason="Nothing to undo" onClick={undo}>
        <UndoIcon />
      </IconButton>
      <IconButton label="Redo" disabled={!canRedo} disabledReason="Nothing to redo" onClick={redo}>
        <RedoIcon />
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-200" />
      <IconButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })}>
        <ZoomInIcon />
      </IconButton>
      <IconButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })}>
        <ZoomOutIcon />
      </IconButton>
      <IconButton label="Fit view" onClick={() => fitView({ duration: 200, padding: 0.2 })}>
        <FitViewIcon />
      </IconButton>
      <IconButton label="Auto layout" title="Auto layout (top to bottom)" onClick={runAutoLayout}>
        <LayoutIcon />
      </IconButton>
      <IconButton
        label={locked ? "Unlock interactions" : "Lock interactions"}
        onClick={() => setCanvasLocked(!locked)}
        className={locked ? "bg-primary-50 text-primary" : ""}
      >
        {locked ? <LockIcon /> : <UnlockIcon />}
      </IconButton>
      <IconButton
        label={minimapVisible ? "Hide minimap" : "Show minimap"}
        onClick={toggleMinimap}
        className={minimapVisible ? "bg-primary-50 text-primary" : ""}
      >
        <MapIcon />
      </IconButton>
    </div>
  );
}
