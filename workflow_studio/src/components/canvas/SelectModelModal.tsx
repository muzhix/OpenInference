/**
 * "Select a Model" modal opened by the model-id field, mirroring the official
 * dialog layout (mask, header with icon + close, sidebar with search / Source
 * chips / Sort By, scrollable model list). The local build has no workspace
 * model listing API, so the honest data model is: search/enter a model id and
 * select it; the Pre-Trained tab explains this instead of inventing entries.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { faClasses } from "../../adapter";
import { UiIcon } from "./hollowIcons";

type SourceTab = "my" | "pretrained" | "starred";

const SOURCE_TABS: { id: SourceTab; label: string; icon: string }[] = [
  { id: "my", label: "My Models", icon: "network" },
  { id: "pretrained", label: "Pre-Trained", icon: "cubes" },
  { id: "starred", label: "Starred", icon: "star" },
];

export function SelectModelModal({
  value,
  onClose,
  onSelect,
}: {
  value: string;
  onClose: () => void;
  onSelect: (modelId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SourceTab>("pretrained");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmed = useMemo(() => query.trim(), [query]);

  // Portal to <body>: rendered in place, the modal would live inside the
  // selected react-flow node, whose elevated stacking context (zIndex ~1000)
  // caps every z-index the modal sets — the node's floating action bar and
  // trays would then draw above the dialog. document.body escapes that context.
  return createPortal(
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label="Select a Model">
      <div className="fixed inset-0 bg-black/25" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl">
          <div className="relative flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-5">
            <h1 className="m-0 flex min-w-0 flex-1 items-center gap-3 text-lg font-semibold leading-none text-gray-900">
              <UiIcon name="network" className="shrink-0 text-lg text-gray-500" />
              <span className="min-w-0 flex-1 leading-none">Select a Model</span>
            </h1>
            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              className="relative z-50 h-6 w-6 shrink-0 rounded-full pt-[2px] text-sm text-gray-500 transition-colors hover:bg-red-100 hover:text-red-500"
            >
              <UiIcon name="x" className="text-sm" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="flex h-full min-h-0 w-72 shrink-0 flex-col gap-2 border-r border-gray-200 pt-4">
              <div className="flex shrink-0 flex-col gap-2 px-4">
                <div className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
                  <UiIcon name="search" className="text-sm text-gray-400" />
                  <input
                    type="text"
                    aria-label="Search models"
                    placeholder="Search by name or model id"
                    value={query}
                    autoFocus
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full bg-transparent text-sm text-gray-800 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-gray-500">Source</span>
                  <div className="flex flex-wrap items-start gap-1.5">
                    {SOURCE_TABS.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        aria-pressed={tab === entry.id}
                        onClick={() => setTab(entry.id)}
                        className={`inline-flex select-none items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          tab === entry.id ? "bg-primary-100 text-primary" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <UiIcon name={entry.icon} className="text-xs" />
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-gray-500">Sort By</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    Recommended
                    <UiIcon name="chevron-down" className="text-xs" />
                  </span>
                </div>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
                  {trimmed ? (
                    <button
                      type="button"
                      onClick={() => onSelect(trimmed)}
                      className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-500">
                        <UiIcon name="network" className="text-base" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                        <span className="truncate text-sm font-medium text-gray-900">{trimmed}</span>
                        <span className="text-xs text-gray-500">Use this model id for the block</span>
                      </span>
                    </button>
                  ) : null}
                  {tab === "pretrained" ? (
                    <div className="p-4 text-xs leading-relaxed text-gray-500">
                      This local build has no workspace model listing. Type a Roboflow model id (for example
                      <span className="mx-1 font-mono text-gray-700">project/version</span>) in the search box above and
                      select it.
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-gray-500">
                      No models here yet — this local build lists workspace models only when a model catalog is
                      configured. Use the search box to enter a model id directly.
                    </div>
                  )}
                  {value ? (
                    <button
                      type="button"
                      onClick={() => onSelect(value)}
                      className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-50 text-primary">
                        <UiIcon name="check" className="text-sm" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                        <span className="truncate text-sm font-medium text-gray-900">{value}</span>
                        <span className="text-xs text-gray-500">Currently selected</span>
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <UiIcon name="network" className="text-2xl text-gray-300" />
                <p className="max-w-sm text-xs leading-relaxed text-gray-500">
                  Model catalog unavailable in this build. Enter a model id via the search box on the left; the id is
                  written to the block's model parameter exactly as typed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
