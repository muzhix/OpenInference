/**
 * Pure ledger helpers (search filter, trash-confirmation gating, relative
 * time) extracted so the behavior is unit-testable (11 §A4 + 01 §4b).
 */

import type { WorkflowSummary } from "../../api/workflowApi";

/** Case-insensitive substring match over the workflow name and slug (A4). */
export function matchesSearch(
  workflow: Pick<WorkflowSummary, "name" | "url">,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const name = workflow.name.toLowerCase();
  const url = workflow.url.toLowerCase();
  return name.includes(needle) || url.includes(needle);
}

/**
 * Trash confirmation gate: the Delete action unlocks only when the typed
 * text equals the workflow slug exactly (01 §4b).
 */
export function canConfirmTrash(input: string, slug: string): boolean {
  return input === slug && slug.length > 0;
}

/**
 * Compact relative time ("just now", "5m ago", "2h ago", "3d ago", "2w ago",
 * "1mo ago", "1y ago") for the card's "Edited <...>" caption.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) {
    return "";
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "";
  }
  const elapsedSeconds = Math.round((now - then) / 1000);
  if (elapsedSeconds < 0) {
    return "";
  }
  if (elapsedSeconds < 60) {
    return "just now";
  }
  const minutes = Math.round(elapsedSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 14) {
    return `${days}d ago`;
  }
  if (days < 60) {
    return `${Math.round(days / 7)}w ago`;
  }
  if (days < 365) {
    return `${Math.max(1, Math.round(days / 30))}mo ago`;
  }
  return `${Math.max(1, Math.round(days / 365))}y ago`;
}

/** Split `items` into chunks of at most `size` (spec batch fetches of ~20). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) {
    return [items];
  }
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
