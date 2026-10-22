/** Sticky ledger header (01 §1): title, Workflows/Evals tabs, search + controls row. */

import { Button } from "../ui/Button";

export function LedgerHeader({
  search,
  onSearchChange,
  onCreate,
  creating,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white px-6 pt-4 pb-3">
      <div>
        <h1 className="text-xl font-normal leading-6 text-gray-900">Workflows</h1>
        <p className="mt-0.5 text-sm leading-4 text-gray-500">
          Build, manage, and run workflows in your workspace.
        </p>
      </div>
      <div role="tablist" aria-label="Workspace sections" className="mt-3 flex gap-6 text-sm">
        <span
          role="tab"
          aria-selected="true"
          className="border-b-2 border-primary px-1 pb-2 font-medium text-gray-900"
        >
          Workflows
        </span>
        <span
          role="tab"
          aria-selected="false"
          title="Evals is not available yet"
          className="cursor-not-allowed px-1 pb-2 text-gray-400"
        >
          Evals
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, contents, or URL"
          aria-label="Search workflows"
          className="h-10 w-72 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            aria-label="Explore templates"
            disabled
            disabledReason="Templates are not available yet"
          >
            Explore Templates
          </Button>
          <button
            type="button"
            aria-label="Toggle workflows view"
            title="List view is not available yet"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
          <Button
            variant="ghost"
            size="md"
            aria-label="New folder"
            disabled
            disabledReason="Folders are not available yet"
          >
            New Folder
          </Button>
          <button
            type="button"
            aria-label="Sort workflows"
            title="Sorting is fixed to Last edited"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary"
          >
            Sort by: Last edited
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 4l3 3 3-3z" />
            </svg>
          </button>
          <Button
            variant="primary"
            size="md"
            aria-label="Create workflow"
            disabled={creating}
            disabledReason="Creating…"
            onClick={onCreate}
          >
            {creating ? "Creating…" : "Create Workflow"}
          </Button>
        </div>
      </div>
    </header>
  );
}
