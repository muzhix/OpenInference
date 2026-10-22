/** Rename dialog (01 §4b): labeled name input, Save -> POST /api/wf/save {id, name}. */

import { useState } from "react";

import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import type { WorkflowSummary } from "../../api/workflowApi";
import { useLedgerStore } from "../../state/ledgerStore";

export function RenameModal({
  workflow,
  onClose,
}: {
  workflow: WorkflowSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const save = async (): Promise<void> => {
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    await useLedgerStore.getState().rename(workflow.id, trimmed);
    const failure = useLedgerStore.getState().mutationError;
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      title="Rename Workflow"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button aria-label="Cancel rename" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            aria-label="Save workflow name"
            disabled={!trimmed || busy}
            disabledReason={busy ? "Saving…" : "Enter a name"}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <label className="block text-xs font-medium text-gray-700" htmlFor="rename-workflow-name">
        Workflow name
      </label>
      <input
        id="rename-workflow-name"
        type="text"
        value={name}
        autoFocus
        className="mt-1 h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-primary focus:outline-none"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void save();
          }
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-[#DC2626]">
          Rename failed: {error}
        </p>
      ) : null}
    </Modal>
  );
}
