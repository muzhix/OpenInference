/**
 * Use Workflow modal (05 §3, publish unlocks Use): Code Snippets tab with the
 * live endpoint URL and ready-to-run curl / Python snippets. The specification
 * is fetched on open (GET /api/wf/spec?preferDraft=true) and inlined minified
 * into both snippets. Cloud API / Self-Hosted API tabs are v1 placeholders.
 */

import { useEffect, useState } from "react";

import { fetchSpec, parseConfig } from "../../api/workflowApi";
import { exportSpec } from "../../adapter";
import { useEditorStore } from "../../state/editorStore";
import { CloseIcon } from "../canvas/icons";
import { IconButton } from "../ui/Button";

const BASE64_PLACEHOLDER = "<BASE64_IMAGE>";

function endpointUrl(): string {
  return `${window.location.origin}/api/wf/run`;
}

function curlSnippet(endpoint: string, specJson: string): string {
  const body = `{"specification": ${specJson}, "inputs": {"image": {"type": "base64", "value": "${BASE64_PLACEHOLDER}"}}}`;
  return [
    `curl -X POST ${endpoint} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${body}'`,
  ].join("\n");
}

function pythonSnippet(endpoint: string, specJson: string): string {
  return [
    `import base64`,
    `import requests`,
    ``,
    `with open("image.jpg", "rb") as image_file:`,
    `    base64_image = base64.b64encode(image_file.read()).decode()`,
    ``,
    `response = requests.post(`,
    `    "${endpoint}",`,
    `    json={`,
    `        "specification": ${specJson},`,
    `        "inputs": {"image": {"type": "base64", "value": base64_image}},`,
    `    },`,
    `)`,
    `outputs = response.json()["outputs"]`,
    `print(outputs)`,
  ].join("\n");
}

/** navigator.clipboard with a legacy fallback so copy works without grants. */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to the textarea path (e.g. permission not granted)
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function UseWorkflowModal({ onClose }: { onClose: () => void }) {
  const workflowUrl = useEditorStore((state) => state.workflowUrl);
  const published = useEditorStore((state) => state.published);
  const [specJson, setSpecJson] = useState<string | null>(null);
  const [copied, setCopied] = useState<"curl" | "python" | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      let resolved: string | null = null;
      try {
        const response = await fetchSpec(workflowUrl ?? "");
        const config = parseConfig(response.workflowSpec.config);
        if (config) {
          resolved = JSON.stringify(config);
        }
      } catch {
        // fall back to the live editor spec (offline / unsaved edge cases)
      }
      if (!resolved) {
        const live = useEditorStore.getState().spec;
        resolved = live ? JSON.stringify(exportSpec(live)) : null;
      }
      if (!cancelled) {
        setSpecJson(resolved);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workflowUrl]);

  const flashCopied = (which: "curl" | "python"): void => {
    setCopied(which);
    window.setTimeout(() => {
      setCopied((current) => (current === which ? null : current));
    }, 1600);
  };

  const endpoint = endpointUrl();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Use Workflow"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85vh] w-[560px] max-w-full flex-col rounded-lg bg-white shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-900">Use Workflow</h2>
            {published ? (
              <span
                aria-label="Workflow is live"
                className="rounded-full bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              >
                Live
              </span>
            ) : null}
          </div>
          <IconButton label="Close Use Workflow dialog" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>

        <div
          role="tablist"
          aria-label="Use workflow tabs"
          className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-4 pt-2"
        >
          <span
            role="tab"
            aria-selected="true"
            className="border-b-2 border-primary px-2 pb-2 text-xs font-medium text-gray-900"
          >
            Code Snippets
          </span>
          <span
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            title="Cloud API is not available in v1"
            className="cursor-not-allowed px-2 pb-2 text-xs text-gray-400"
          >
            Cloud API
          </span>
          <span
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            title="Self-hosted snippets are not available in v1"
            className="cursor-not-allowed px-2 pb-2 text-xs text-gray-400"
          >
            Self-Hosted API
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <dl className="mb-3 grid grid-cols-[120px_1fr] items-center gap-y-2 text-xs">
            <dt className="font-medium text-gray-500">Workflow ID</dt>
            <dd className="truncate font-mono text-gray-800" title={workflowUrl ?? ""}>
              {workflowUrl ?? "—"}
            </dd>
            <dt className="font-medium text-gray-500">Endpoint URL</dt>
            <dd className="truncate font-mono text-gray-800" title={endpoint}>
              {endpoint}
            </dd>
          </dl>

          <SnippetBlock
            title="curl"
            copyLabel="Copy curl snippet"
            copiedNow={copied === "curl"}
            onCopy={() => {
              if (specJson !== null) {
                void copyText(curlSnippet(endpoint, specJson));
                flashCopied("curl");
              }
            }}
          >
            {specJson === null ? "Loading the workflow specification…" : curlSnippet(endpoint, specJson)}
          </SnippetBlock>

          <SnippetBlock
            title="python"
            copyLabel="Copy Python snippet"
            copiedNow={copied === "python"}
            onCopy={() => {
              if (specJson !== null) {
                void copyText(pythonSnippet(endpoint, specJson));
                flashCopied("python");
              }
            }}
          >
            {specJson === null ? "Loading the workflow specification…" : pythonSnippet(endpoint, specJson)}
          </SnippetBlock>
        </div>
      </div>
    </div>
  );
}

function SnippetBlock({
  title,
  copyLabel,
  copiedNow,
  onCopy,
  children,
}: {
  title: string;
  copyLabel: string;
  copiedNow: boolean;
  onCopy: () => void;
  children: string;
}) {
  return <section className="mb-3" aria-label={`${title} code snippet`}>
    <div className="mb-1 flex items-center justify-between">
      <p className="text-xs font-medium text-gray-700">{title}</p>
      <button
        type="button"
        aria-label={copyLabel}
        onClick={onCopy}
        className="inline-flex h-6 items-center rounded-md border border-gray-200 px-2 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        {copiedNow ? "Copied!" : "Copy"}
      </button>
    </div>
    <pre className="max-h-56 overflow-auto rounded-md border border-gray-100 bg-gray-50 p-2 font-mono text-[10px] leading-4 text-gray-700">
      {children}
    </pre>
  </section>;
}
