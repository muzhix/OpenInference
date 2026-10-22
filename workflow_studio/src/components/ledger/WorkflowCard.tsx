/**
 * Ledger card (01 §2, 13 §2): 304x217, read-only mini-canvas thumbnail in the
 * top 160px, name + status badge + AI badge + relative time below. Hover
 * reveals a (visual) checkbox and the ⋯ menu; right-click opens the same menu.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../ui/Badge";
import type { WorkflowSummary } from "../../api/workflowApi";
import type { WorkflowSpecification } from "../../types/spec";
import type { SpecState } from "../../state/ledgerStore";
import { CardMenu } from "./CardMenu";
import type { CardMenuActions } from "./CardMenu";
import { WorkflowThumbnail } from "./WorkflowThumbnail";
import { formatRelativeTime } from "./helpers";

export function WorkflowCard({
  workflow,
  spec,
  specState,
  actions,
}: {
  workflow: WorkflowSummary;
  spec: WorkflowSpecification | null;
  specState: SpecState;
  actions: CardMenuActions;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const aiTouched = Boolean(workflow.createdByAI || workflow.editedByAI);
  const aiTitle = workflow.createdByAI
    ? workflow.editedByAI
      ? "Created and edited by AI"
      : "Created by AI"
    : "Edited by AI";
  const relative = formatRelativeTime(workflow.updateTime);

  return (
    <article
      className="group relative h-[217px] w-[304px] shrink-0 cursor-pointer overflow-hidden rounded-md border border-gray-300 bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)] transition-shadow hover:shadow-md focus-within:shadow-md"
      aria-label={`Open workflow ${workflow.name}`}
      onClick={() => navigate(`/build?workflowUrl=${encodeURIComponent(workflow.url)}`)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <div className="workflow-studio-canvas relative h-40 border-b border-gray-100 bg-gray-50">
        <WorkflowThumbnail spec={spec} state={specState} />
        <span
          aria-hidden="true"
          title="Batch selection is not available yet"
          className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        />
        <button
          type="button"
          aria-label="Open menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen ? "true" : undefined}
          className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 focus-visible:opacity-100 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="8" cy="13" r="1.4" />
          </svg>
        </button>
        {menuOpen ? <CardMenu onClose={() => setMenuOpen(false)} actions={actions} /> : null}
      </div>
      <div className="flex h-[57px] flex-col justify-between px-3 pb-2 pt-1.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-4 text-gray-900" title={workflow.name}>
          {workflow.name}
        </h3>
        <div className="flex items-center gap-1.5">
          {workflow.published ? (
            <Badge tone="green">Published</Badge>
          ) : (
            <Badge tone="gray">Draft</Badge>
          )}
          {aiTouched ? (
            <Badge tone="purple" title={aiTitle}>
              AI
            </Badge>
          ) : null}
          {relative ? (
            <span className="truncate text-xs text-gray-500" title={workflow.updateTime ?? undefined}>
              Edited {relative}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
