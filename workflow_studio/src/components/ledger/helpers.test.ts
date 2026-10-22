import { describe, expect, it } from "vitest";

import { canConfirmTrash, chunk, formatRelativeTime, matchesSearch } from "./helpers";

const workflow = { name: "Demo Workflow", url: "demo-workflow" };

describe("matchesSearch", () => {
  it("matches everything when the query is blank", () => {
    expect(matchesSearch(workflow, "")).toBe(true);
    expect(matchesSearch(workflow, "   ")).toBe(true);
  });

  it("matches name and slug case-insensitively as substrings", () => {
    expect(matchesSearch(workflow, "demo")).toBe(true);
    expect(matchesSearch(workflow, "DEMO")).toBe(true);
    expect(matchesSearch(workflow, "workflow")).toBe(true);
    expect(matchesSearch(workflow, "demo-work")).toBe(true);
  });

  it("rejects queries matching neither name nor slug", () => {
    expect(matchesSearch(workflow, "cigarette")).toBe(false);
    expect(matchesSearch(workflow, "cigarette ")).toBe(false);
    expect(matchesSearch(workflow, "demo/workflow")).toBe(false);
  });

  it("trims the query before matching", () => {
    expect(matchesSearch(workflow, "  demo  ")).toBe(true);
  });
});

describe("canConfirmTrash", () => {
  it("requires an exact slug match", () => {
    expect(canConfirmTrash("demo-workflow", "demo-workflow")).toBe(true);
    expect(canConfirmTrash("", "demo-workflow")).toBe(false);
    expect(canConfirmTrash("demo", "demo-workflow")).toBe(false);
    expect(canConfirmTrash("demo-workflow-2", "demo-workflow")).toBe(false);
  });

  it("does not accept near-misses (whitespace or casing)", () => {
    expect(canConfirmTrash("demo-workflow ", "demo-workflow")).toBe(false);
    expect(canConfirmTrash("Demo-Workflow", "demo-workflow")).toBe(false);
  });

  it("never unlocks for an empty slug", () => {
    expect(canConfirmTrash("", "")).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-21T18:00:00Z");

  it("returns an empty string for missing or invalid timestamps", () => {
    expect(formatRelativeTime(null)).toBe("");
    expect(formatRelativeTime(undefined)).toBe("");
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });

  it("formats seconds through years", () => {
    expect(formatRelativeTime("2026-10-21T17:59:40Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-21T17:55:00Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-10-21T16:00:00Z", now)).toBe("2h ago");
    expect(formatRelativeTime("2026-10-18T18:00:00Z", now)).toBe("3d ago");
    expect(formatRelativeTime("2026-10-07T18:00:00Z", now)).toBe("2w ago");
    expect(formatRelativeTime("2026-08-21T18:00:00Z", now)).toBe("2mo ago");
    expect(formatRelativeTime("2024-10-21T18:00:00Z", now)).toBe("2y ago");
  });

  it("returns an empty string for future timestamps", () => {
    expect(formatRelativeTime("2026-10-21T18:10:00Z", now)).toBe("");
  });
});

describe("chunk", () => {
  it("splits into batches of at most the requested size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2], 20)).toEqual([[1, 2]]);
  });

  it("keeps an empty input empty", () => {
    expect(chunk([], 20)).toEqual([]);
  });
});
