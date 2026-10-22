/** Workflow editor page: top bar (Save/Publish/Use/Run), status banner, validation strip, canvas + run panel. */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { WorkflowCanvas } from "../components/canvas/WorkflowCanvas";
import { UseWorkflowModal } from "../components/editor/UseWorkflowModal";
import { VersionHistoryPanel } from "../components/editor/VersionHistoryPanel";
import { RunPanel } from "../components/run/RunPanel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useEditorStore, selectCanSave, selectDirty, selectValidation } from "../state/editorStore";
import { useRegistryStore } from "../state/registryStore";

export function EditorPage() {
  const [searchParams] = useSearchParams();
  const workflowUrl = searchParams.get("url") ?? searchParams.get("workflowUrl");
  const loadStatus = useEditorStore((state) => state.loadStatus);
  const loadError = useEditorStore((state) => state.loadError);
  const loadWorkflow = useEditorStore((state) => state.loadWorkflow);
  const fetchRegistry = useRegistryStore((state) => state.fetch);

  useEffect(() => {
    void loadWorkflow(workflowUrl);
    void fetchRegistry();
  }, [loadWorkflow, fetchRegistry, workflowUrl]);

  if (loadStatus === "idle" || loadStatus === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500" aria-live="polite">Loading workflow…</p>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-danger" aria-live="polite">Could not load workflow: {loadError}</p>
        <Link to="/workflows" aria-label="Back to workflows list" className="text-sm text-primary hover:underline">
          ← Workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <StatusBanner />
      <ValidationStrip />
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1" aria-label="Workflow canvas">
          <WorkflowCanvas />
        </main>
        <RunPanel />
      </div>
    </div>
  );
}

function TopBar() {
  const workflowName = useEditorStore((state) => state.workflowName);
  const published = useEditorStore((state) => state.published);
  const hasUnpublishedChanges = useEditorStore((state) => state.hasUnpublishedChanges);
  const workflowId = useEditorStore((state) => state.workflowId);
  const workflowUrl = useEditorStore((state) => state.workflowUrl);
  const saving = useEditorStore((state) => state.saving);
  const publishing = useEditorStore((state) => state.publishing);
  const saveFlashAt = useEditorStore((state) => state.saveFlashAt);
  const toggleRunPanel = useEditorStore((state) => state.toggleRunPanel);
  const runPanelOpen = useEditorStore((state) => state.runPanelOpen);
  const state = useEditorStore((selector) => selector);
  const canSave = selectCanSave(state);
  const dirty = selectDirty(state);
  const validation = selectValidation(state);
  const [savedFlash, setSavedFlash] = useState(false);
  const [useOpen, setUseOpen] = useState(false);

  useEffect(() => {
    if (!saveFlashAt) {
      return;
    }
    setSavedFlash(true);
    const timer = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(timer);
  }, [saveFlashAt]);

  useEffect(() => {
    document.title = workflowName ? `${workflowName} — Workflow Studio` : "Workflow Studio";

    return () => {
      document.title = "Workflow Studio";
    };
  }, [workflowName]);

  const saveDisabledReason = !workflowId
    ? "Create this workflow from the Workflows page first"
    : !dirty
      ? "No changes to save"
      : validation.errors.length > 0
        ? "Fix validation errors before saving"
        : null;
  // Publish makes the latest saved version live (05 §3): enabled whenever the
  // workflow is unpublished or has unpublished changes (incl. unsaved edits).
  const publishable = !published || hasUnpublishedChanges || dirty;
  const publishDisabled = !workflowId || publishing || !publishable;
  // Use unlocks on publish and locks again once newer draft changes exist (05 §3).
  const useEnabled = workflowId !== null && published && !hasUnpublishedChanges;
  const useDisabledReason = !workflowId
    ? "Create this workflow from the Workflows page first"
    : !published
      ? "Publish the workflow first"
      : hasUnpublishedChanges
        ? "Publish the saved changes first"
        : null;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/workflows"
          aria-label="Back to workflows list"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Workflows
        </Link>
        <span aria-hidden="true" className="h-4 w-px bg-gray-200" />
        <h1 className="truncate text-sm font-medium text-gray-900" title={workflowName}>
          {workflowName}
        </h1>
        {published ? (
          hasUnpublishedChanges || dirty ? (
            <Badge tone="amber" title="Saved changes are not live yet">Unpublished changes</Badge>
          ) : (
            <Badge tone="green">Published</Badge>
          )
        ) : (
          <Badge tone="gray">Draft</Badge>
        )}
        <VersionHistoryPanel />
        {savedFlash ? (
          <span className="text-xs font-medium text-[#16A34A]" aria-live="polite">Saved</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Save workflow draft"
          disabled={!canSave || saving}
          disabledReason={saving ? "Saving…" : saveDisabledReason}
          onClick={() => void useEditorStore.getState().save()}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="primary"
          aria-label="Publish workflow"
          disabled={publishDisabled}
          disabledReason={
            !workflowId
              ? "Create this workflow from the Workflows page first"
              : publishing
                ? "Publishing…"
                : "Nothing to publish"
          }
          onClick={() => void useEditorStore.getState().publish()}
        >
          {publishing ? "Publishing…" : "Publish"}
        </Button>
        <Button
          aria-label="Use workflow"
          disabled={!useEnabled}
          disabledReason={useDisabledReason}
          onClick={() => setUseOpen(true)}
        >
          Use
        </Button>
        <Button
          aria-label={runPanelOpen ? "Close run panel" : "Open run panel"}
          onClick={toggleRunPanel}
        >
          Run
        </Button>
      </div>
      {useOpen ? <UseWorkflowModal onClose={() => setUseOpen(false)} /> : null}
    </header>
  );
}

function StatusBanner() {
  const published = useEditorStore((state) => state.published);
  const hasUnpublishedChanges = useEditorStore((state) => state.hasUnpublishedChanges);
  const dirty = selectDirty(useEditorStore((state) => state));

  if (!published) {
    return (
      <div className="flex shrink-0 items-center gap-2 bg-[#FBBF24] px-4 py-1.5 text-xs font-medium text-[#111827]" aria-live="polite">
        ✎ Draft saved — not published yet
      </div>
    );
  }
  if (hasUnpublishedChanges || dirty) {
    return (
      <div className="flex shrink-0 items-center gap-2 bg-[#FBBF24] px-4 py-1.5 text-xs font-medium text-[#111827]" aria-live="polite">
        ✎ Saved changes are not live yet
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2 bg-[#16A34A] px-4 py-1.5 text-xs font-medium text-white" aria-live="polite">
      ✓ Published
    </div>
  );
}

function ValidationStrip() {
  const state = useEditorStore((selector) => selector);
  const { errors, warnings } = selectValidation(state);
  const saveError = state.saveError;
  if (errors.length === 0 && warnings.length === 0 && !saveError) {
    return null;
  }
  return (
    <div
      aria-label="Validation status"
      className="max-h-28 shrink-0 overflow-y-auto border-b border-gray-200 bg-red-50 px-4 py-1.5 text-xs"
    >
      {saveError ? <p className="font-medium text-danger">Save failed: {saveError}</p> : null}
      {errors.map((issue, index) => (
        <p key={`error-${index}`} className="text-danger">
          {issue.path ? <span className="font-mono">{issue.path}: </span> : null}
          {issue.message}
        </p>
      ))}
      {warnings.map((issue, index) => (
        <p key={`warning-${index}`} className="text-[#B45309]">
          {issue.path ? <span className="font-mono">{issue.path}: </span> : null}
          {issue.message}
        </p>
      ))}
    </div>
  );
}
