/**
 * Workflows ledger (01): sticky header + responsive card grid. List metadata
 * and thumbnail specs are loaded separately (list first, then batched
 * /api/wf/configs); every mutation refreshes the list.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { LedgerHeader } from "../components/ledger/LedgerHeader";
import { RenameModal } from "../components/ledger/RenameModal";
import { TrashModal } from "../components/ledger/TrashModal";
import { WorkflowCard } from "../components/ledger/WorkflowCard";
import { matchesSearch } from "../components/ledger/helpers";
import { useLedgerStore } from "../state/ledgerStore";

import type { WorkflowSummary } from "../api/workflowApi";

export function LedgerPage() {
  const navigate = useNavigate();
  const workflows = useLedgerStore((state) => state.workflows);
  const status = useLedgerStore((state) => state.status);
  const error = useLedgerStore((state) => state.error);
  const specs = useLedgerStore((state) => state.specs);
  const specStates = useLedgerStore((state) => state.specStates);
  const creating = useLedgerStore((state) => state.creating);
  const mutationError = useLedgerStore((state) => state.mutationError);
  const [search, setSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<WorkflowSummary | null>(null);
  const [trashTarget, setTrashTarget] = useState<WorkflowSummary | null>(null);

  useEffect(() => {
    void useLedgerStore.getState().fetch();
  }, []);

  const visible = useMemo(
    () => workflows.filter((workflow) => matchesSearch(workflow, search)),
    [workflows, search],
  );

  const handleCreate = async (): Promise<void> => {
    const created = await useLedgerStore.getState().create();
    if (created) {
      navigate(`/build?workflowUrl=${encodeURIComponent(created.url)}`);
    }
  };

  const actions = (workflow: WorkflowSummary) => ({
    onDuplicate: () => void useLedgerStore.getState().duplicate(workflow.id),
    onRename: () => setRenameTarget(workflow),
    onTrash: () => setTrashTarget(workflow),
  });

  return (
    <div className="flex h-full flex-col">
      <LedgerHeader
        search={search}
        onSearchChange={setSearch}
        onCreate={() => void handleCreate()}
        creating={creating}
      />
      {mutationError ? (
        <div role="alert" className="flex shrink-0 items-center justify-between bg-red-50 px-6 py-1.5 text-xs text-[#DC2626]">
          <span>Operation failed: {mutationError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            className="font-medium hover:underline"
            onClick={() => useLedgerStore.getState().clearMutationError()}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <main className="min-h-0 flex-1 overflow-y-auto" aria-label="Workflows list">
        <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:px-8">
          {status === "idle" || status === "loading" ? (
            <SkeletonCards />
          ) : status === "error" ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-sm text-[#DC2626]" aria-live="polite">Could not load workflows: {error}</p>
              <Button
                aria-label="Retry loading workflows"
                onClick={() => void useLedgerStore.getState().fetch()}
              >
                Retry
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <p className="text-sm text-gray-500" aria-live="polite">No workflows found</p>
              {search ? (
                <p className="mt-1 text-xs text-gray-400">No workflow matches “{search.trim()}”.</p>
              ) : null}
            </div>
          ) : (
            visible.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                spec={specs[workflow.id] ?? null}
                specState={specStates[workflow.id] ?? "loading"}
                actions={actions(workflow)}
              />
            ))
          )}
        </div>
      </main>
      {renameTarget ? (
        <RenameModal workflow={renameTarget} onClose={() => setRenameTarget(null)} />
      ) : null}
      {trashTarget ? <TrashModal workflow={trashTarget} onClose={() => setTrashTarget(null)} /> : null}
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-[217px] w-[304px] shrink-0 animate-pulse rounded-md border border-gray-200 bg-white"
        >
          <div className="h-40 rounded-t-md bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-2/3 rounded bg-gray-100" />
            <div className="h-3 w-1/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </>
  );
}
