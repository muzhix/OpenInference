/**
 * Version history (C4): clock-icon button in the editor top bar opens a popover
 * listing the workflow's saved versions (GET /api/wf/versions). Selecting a row
 * loads that version's config (GET /api/wf/versions/{id}) into a read-only
 * pretty JSON block; restoring stays out of scope for v1.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

import { fetchVersion, fetchVersions, parseConfig } from "../../api/workflowApi";
import type { WorkflowVersionDetail, WorkflowVersionSummary } from "../../api/workflowApi";
import { useEditorStore } from "../../state/editorStore";
import { UiIcon } from "../canvas/hollowIcons";
import { formatRelativeTime } from "../ledger/helpers";
import { IconButton } from "../ui/Button";

export function VersionHistoryPanel() {
  const workflowUrl = useEditorStore((state) => state.workflowUrl);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={wrapperRef}>
      <IconButton
        label="Version history"
        title="Version history"
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className={open ? "bg-gray-100" : ""}
      >
        <UiIcon name="clock" className="text-base" />
      </IconButton>
      {open ? <VersionHistoryCard wrapperRef={wrapperRef} workflowUrl={workflowUrl} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function VersionHistoryCard({
  wrapperRef,
  workflowUrl,
  onClose,
}: {
  wrapperRef: RefObject<HTMLDivElement | null>;
  workflowUrl: string | null;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [versions, setVersions] = useState<WorkflowVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkflowVersionDetail | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      // Outside the whole wrapper closes; clicking the toggle itself re-toggles.
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, wrapperRef]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const response = await fetchVersions(workflowUrl ?? "");
        if (!cancelled) {
          setVersions(response.versions);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workflowUrl]);

  const openVersion = async (versionId: string): Promise<void> => {
    setSelected(null);
    try {
      setSelected(await fetchVersion(versionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const config = selected ? parseConfig(selected.config) : null;
  const title = selected ? selected.name : "Version history";

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Version history"
      className="absolute right-0 top-full z-40 mt-2 flex max-h-[70vh] w-[360px] flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
        <h2 className="truncate text-sm font-medium text-gray-900" title={title}>
          {title}
        </h2>
        <IconButton label="Close version history" onClick={onClose} className="shrink-0">
          <UiIcon name="x" className="text-sm" />
        </IconButton>
      </header>

      {selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <pre
            aria-label="Version config JSON"
            className="min-h-0 flex-1 overflow-auto bg-gray-50 p-3 font-mono text-[10px] leading-4 text-gray-700"
          >
            {JSON.stringify(config ?? selected.config, null, 2)}
          </pre>
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
            <Button label="Back to version list" onClick={() => setSelected(null)} />
            <button
              type="button"
              aria-label="Restore version"
              aria-disabled="true"
              title="Restoring versions is not available in v1"
              className="inline-flex h-7 cursor-not-allowed items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-white opacity-50"
            >
              Restore
            </button>
          </footer>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Version list">
          {error ? <p className="px-2 py-3 text-xs text-danger">Could not load versions: {error}</p> : null}
          {!error && versions === null ? (
            <p className="px-2 py-3 text-xs text-gray-500" aria-live="polite">Loading versions…</p>
          ) : null}
          {versions !== null && versions.length === 0 ? (
            <p className="px-2 py-3 text-xs text-gray-500">No saved versions yet.</p>
          ) : null}
          {versions !== null && versions.length === 1 ? (
            <p className="px-2 pb-2 text-[11px] text-gray-400">
              Only one version so far — saving again adds to the history.
            </p>
          ) : null}
          {versions?.map((version) => (
            <button
              key={version.id}
              type="button"
              aria-label={`Show version ${version.name}`}
              onClick={() => void openVersion(version.id)}
              className="flex w-full flex-col items-start gap-1 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-gray-200 hover:bg-gray-50"
            >
              <span className="truncate text-xs font-medium text-gray-800" title={version.name}>
                {version.name}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500" title={version.createdAt}>
                  {formatRelativeTime(version.createdAt)}
                </span>
                {version.isLatest ? (
                  <span className="rounded-full border border-primary px-1.5 py-px text-[10px] font-medium text-primary">
                    Latest
                  </span>
                ) : null}
                {version.published ? (
                  <span className="rounded-full bg-[#16A34A] px-1.5 py-px text-[10px] font-medium text-white">
                    Published
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Button({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 items-center rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      ← Back
    </button>
  );
}
