/**
 * Run panel (M4, 06-run-panel-and-execution.md): right-side test panel with
 * two states — input (source pills, dropzone / image URL, structure overview,
 * Run button) and results (per-output rendering, Rerun / Edit input). Execution
 * lives in the run store; canvas thumbnails read `stepThumbnails` from it.
 */

import { useEditorStore } from "../../state/editorStore";
import { useRunStore } from "../../state/runStore";
import { UiIcon } from "../canvas/hollowIcons";
import { Button, IconButton } from "../ui/Button";
import { RunInputState } from "./RunInputState";
import { RunResultsState } from "./RunResultsState";

export function RunPanel() {
  const open = useEditorStore((state) => state.runPanelOpen);
  const toggleRunPanel = useEditorStore((state) => state.toggleRunPanel);
  const mode = useRunStore((state) => state.mode);
  if (!open) {
    return null;
  }
  return (
    <aside
      aria-label="Run workflow panel"
      className="flex h-full w-[639px] shrink-0 flex-col border-l border-gray-200 bg-white"
    >
      {mode === "input" ? (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <h2 className="text-sm font-medium text-gray-900">Test Your Workflow</h2>
          <div className="flex items-center gap-1">
            <IconButton label="Expand run panel" disabled disabledReason="Full-width results view is not available in v1">
              <UiIcon name="expand" className="text-base" />
            </IconButton>
            <IconButton label="Close run panel" onClick={toggleRunPanel}>
              <UiIcon name="x" className="text-base" />
            </IconButton>
          </div>
        </header>
      ) : (
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4">
          <h2 className="text-sm font-medium text-gray-900">Run Workflow</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label="Edit input" onClick={() => useRunStore.getState().editInput()}>
              ← Edit input
            </Button>
            <Button
              variant="primary"
              aria-label="Rerun workflow"
              onClick={() => void useRunStore.getState().run()}
            >
              ↻ Rerun
            </Button>
            <div className="flex items-center gap-1">
              <IconButton label="Fullscreen results" disabled disabledReason="Fullscreen results are not available in v1">
                <UiIcon name="fullscreen" className="text-base" />
              </IconButton>
              <IconButton label="Expand run panel" disabled disabledReason="Full-width results view is not available in v1">
                <UiIcon name="expand" className="text-base" />
              </IconButton>
              <IconButton label="Close run panel" onClick={toggleRunPanel}>
                <UiIcon name="x" className="text-base" />
              </IconButton>
            </div>
          </div>
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "input" ? <RunInputState /> : <RunResultsState />}
      </div>
    </aside>
  );
}
