/**
 * Trash confirmation (01 §4b): the Delete action stays disabled until the
 * user types the workflow slug exactly, then POST /api/wf/delete.
 */

import { useState } from "react";

import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import type { WorkflowSummary } from "../../api/workflowApi";
import { useLedgerStore } from "../../state/ledgerStore";
import { canConfirmTrash } from "./helpers";

export function TrashModal({
  workflow,
  onClose,
}: {
  workflow: WorkflowSummary;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = canConfirmTrash(confirmation, workflow.url);
  const confirm = async (): Promise<void> => {
    if (!canConfirm || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    await useLedgerStore.getState().trash([workflow.id]);
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
      title="Move workflow to Trash?"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button aria-label="Cancel move to trash" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            aria-label="Move workflow to trash"
            aria-disabled={!canConfirm || busy ? "true" : undefined}
            title={!canConfirm ? `Type "${workflow.url}" to enable deletion` : undefined}
            className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-medium transition-colors ${
              canConfirm && !busy
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                : "cursor-not-allowed bg-[#DC2626] text-white opacity-50"
            }`}
            onClick={(event) => {
              event.preventDefault();
              if (canConfirm && !busy) {
                void confirm();
              }
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600">
        <span className="font-medium text-gray-900">{workflow.name}</span> will be moved to
        Trash and permanently deleted after 30 days.
      </p>
      <label className="mt-4 block text-xs font-medium text-gray-700" htmlFor="trash-confirmation">
        {`Type "${workflow.url}" to confirm`}
      </label>
      <input
        id="trash-confirmation"
        type="text"
        value={confirmation}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder={workflow.url}
        className="mt-1 h-9 w-full rounded-lg border border-gray-300 px-3 font-mono text-sm text-gray-900 focus:border-primary focus:outline-none"
        onChange={(event) => setConfirmation(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void confirm();
          }
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-[#DC2626]">
          Delete failed: {error}
        </p>
      ) : null}
    </Modal>
  );
}
