/**
 * Run panel input state (D1): source pills, file dropzone with hidden file
 * input, Image URL secondary source with HEAD precheck, Sinks/Run Settings
 * placeholders, workflow structure overview and the primary Run button.
 */

import { useRef, useState } from "react";

import { blockShortName } from "../../adapter";
import { stepsToList } from "../../types/spec";
import { useEditorStore } from "../../state/editorStore";
import { useRunStore } from "../../state/runStore";
import { UiIcon } from "../canvas/hollowIcons";
import { Button, IconButton } from "../ui/Button";
import { formatFileSize, stripDataUrlPrefix } from "./runUtils";
import type { RunImageInput } from "./runUtils";

const FILE_ACCEPT = "image/*,.heic,.heif,video/mp4,video/quicktime,.json,.txt";

export function RunInputState() {
  const imageInput = useRunStore((state) => state.imageInput);
  const running = useRunStore((state) => state.running);
  const error = useRunStore((state) => state.error);
  const setInput = useRunStore((state) => state.setInput);
  const run = useRunStore((state) => state.run);
  const [tab, setTab] = useState<"file" | "url">("file");

  const disabledReason = !imageInput
    ? "Select an input image first"
    : running
      ? "Workflow is running…"
      : null;

  return (
    <div className="flex flex-col gap-4 p-4" aria-label="Run panel input">
      <p className="text-xs text-gray-500">Uses local execution</p>

      <SourcePills />

      {tab === "file" ? (
        imageInput?.kind === "base64" ? (
          <CommittedFilePreview input={imageInput} onClear={() => setInput(null)} />
        ) : (
          <FileDropzone onCommit={setInput} />
        )
      ) : imageInput?.kind === "url" ? (
        <CommittedUrlPreview input={imageInput} onClear={() => setInput(null)} />
      ) : (
        <UrlSource onCommit={setInput} />
      )}

      <div className="flex justify-center">
        {tab === "file" ? (
          <button
            type="button"
            aria-label="Switch to Image URL source"
            onClick={() => setTab("url")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Image URL
          </button>
        ) : (
          <button
            type="button"
            aria-label="Switch to file upload source"
            onClick={() => setTab("file")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Upload file
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-2 text-xs text-gray-700"
          title="Sinks are always enabled in v1"
        >
          Sinks on
          <span
            aria-label="Sinks on switch (always enabled)"
            aria-disabled="true"
            className="inline-flex h-5 w-9 items-center rounded-full bg-gray-200 p-0.5"
          >
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </span>
        <RunSettingsPopover />
      </div>

      <WorkflowOverview />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-danger"
        >
          Run failed: {error}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Run Workflow"
        aria-disabled={disabledReason !== null}
        title={disabledReason ?? "Run the workflow with the local execution engine"}
        onClick={() => {
          if (disabledReason !== null) {
            return;
          }
          void run();
        }}
        className={`h-10 w-full rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
          disabledReason !== null
            ? "cursor-not-allowed bg-gray-200 text-gray-500"
            : "bg-primary text-white hover:bg-[#5B21B6]"
        }`}
      >
        {running ? "Running…" : "Run Workflow"}
      </button>
      {running ? (
        <p className="text-center text-xs text-gray-500" aria-live="polite">
          Fetching the latest workflow and executing locally…
        </p>
      ) : null}
    </div>
  );
}

function SourcePills() {
  return (
    <div className="flex items-center gap-2" aria-label="Input source">
      <span className="text-xs text-gray-700">Source:</span>
      <span className="rounded-full border border-primary bg-primary-50 px-3 py-1 text-xs font-medium text-primary">
        File
      </span>
      <span
        aria-disabled="true"
        title="Coming soon"
        className="cursor-not-allowed rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400"
      >
        Webcam
      </span>
      <span
        aria-disabled="true"
        title="Coming soon"
        className="cursor-not-allowed rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400"
      >
        Stream
      </span>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function FileDropzone({ onCommit }: { onCommit: (input: RunImageInput) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commitFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    onCommit({
      kind: "base64",
      value: stripDataUrlPrefix(dataUrl),
      dataUrl,
      fileName: file.name,
      sizeBytes: file.size,
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Test image drop zone"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        void commitFile(event.dataTransfer.files[0]);
      }}
      className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors ${
        dragOver ? "border-primary bg-primary-50" : "border-gray-300 bg-white hover:border-gray-400"
      }`}
    >
      <p className="text-sm text-gray-500">Drag and drop an image here or click to browse</p>
      <p className="text-xs text-gray-400">PNG · JPG · WEBP · MP4 · MOV</p>
      <input
        ref={inputRef}
        type="file"
        aria-label="Test image file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void commitFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function CommittedFilePreview({
  input,
  onClear,
}: {
  input: RunImageInput;
  onClear: () => void;
}) {
  const isImage = input.dataUrl?.startsWith("data:image/") ?? false;
  return (
    <div
      aria-label="Selected test input file"
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
    >
      {isImage ? (
        <img src={input.dataUrl} alt="Selected input preview" className="h-24 rounded" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded bg-gray-50 text-xs text-gray-400">
          File
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800" title={input.fileName ?? ""}>
          {input.fileName ?? "file"}
        </p>
        <p className="text-xs text-gray-500">
          {input.sizeBytes !== undefined ? formatFileSize(input.sizeBytes) : ""}
        </p>
      </div>
      <Button variant="ghost" aria-label="Remove test input file" onClick={onClear}>
        Remove
      </Button>
    </div>
  );
}

function UrlSource({ onCommit }: { onCommit: (input: RunImageInput) => void }) {
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);

  const commit = async () => {
    const url = draft.trim();
    if (!url || checking) {
      return;
    }
    setChecking(true);
    // HEAD precheck (06 §2b). CORS/network failures are non-fatal: the URL is
    // committed as "unverified" and still allowed to run.
    let validUrl: boolean | undefined;
    try {
      const response = await fetch(url, { method: "HEAD" });
      validUrl = response.ok;
    } catch {
      validUrl = undefined;
    }
    setChecking(false);
    onCommit({ kind: "url", value: url, validUrl });
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="url"
        aria-label="Image URL"
        placeholder="https://example.com/image.jpg"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
        }}
        className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-primary"
      />
      {checking ? <p className="text-xs text-gray-500">Checking URL…</p> : null}
    </div>
  );
}

function CommittedUrlPreview({
  input,
  onClear,
}: {
  input: RunImageInput;
  onClear: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      aria-label="Selected test input URL"
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
    >
      {!broken ? (
        <img
          src={input.value}
          alt="Selected URL preview"
          onError={() => setBroken(true)}
          className="h-24 rounded"
        />
      ) : (
        <p className="max-w-[280px] truncate font-mono text-xs text-gray-600" title={input.value}>
          {input.value}
        </p>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800" title={input.value}>
          Image URL
        </p>
        <p className="text-xs text-gray-500">
          {input.validUrl === true
            ? "URL verified"
            : input.validUrl === false
              ? "URL precheck failed — run may fail"
              : "URL unverified (precheck blocked)"}
        </p>
      </div>
      <Button variant="ghost" aria-label="Save Current Input" disabled disabledReason="Saving inputs is not available in v1">
        Save Current Input
      </Button>
      <Button variant="ghost" aria-label="Remove test input URL" onClick={onClear}>
        Remove
      </Button>
    </div>
  );
}

function RunSettingsPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton label="Run Settings" title="Run Settings" onClick={() => setOpen(!open)}>
        <UiIcon name="settings" className="text-base" />
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-xl">
          No settings in v1
        </div>
      ) : null}
    </div>
  );
}

function WorkflowOverview() {
  const spec = useEditorStore((state) => state.spec);
  const [open, setOpen] = useState(true);
  const steps = spec ? stepsToList(spec.steps) : [];
  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        aria-label="Workflow structure overview"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Workflow structure
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <UiIcon name="chevron-down" className="text-base" />
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-gray-100 px-3 py-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Inputs</p>
            {(spec?.inputs ?? []).map((input) => (
              <div key={input.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-800">{input.name}</span>
                <span className="text-gray-500">{input.type}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Steps</p>
            {steps.length === 0 ? <p className="text-xs text-gray-400">No steps</p> : null}
            {steps.map(({ name, step }) => (
              <div key={name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-800" title={name}>
                  {name}
                </span>
                <span className="shrink-0 truncate text-gray-500" title={step.type}>
                  {blockShortName(step.type)}
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Outputs</p>
            {(spec?.outputs ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">No outputs</p>
            ) : null}
            {(spec?.outputs ?? []).map((output) => (
              <div key={output.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-800">{output.name}</span>
                <span className="truncate text-gray-500" title={output.selector}>
                  {output.selector}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
