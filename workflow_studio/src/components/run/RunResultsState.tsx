/**
 * Run panel results state (D3/D4): one section per output key (aligned with
 * the executed spec's outputs order), classified into image / scalar /
 * predictions-table / pretty-JSON views, plus a collapsible full-response JSON.
 */

import { useRunStore } from "../../state/runStore";
import {
  imageSrc,
  isImageValue,
  isPredictionsValue,
  isScalarValue,
  orderedOutputNames,
} from "./runUtils";
import type { PredictionsValue, PredictionItem } from "./runUtils";

export function RunResultsState() {
  const outputs = useRunStore((state) => state.outputs);
  const runSpec = useRunStore((state) => state.runSpec);
  const rawResponse = useRunStore((state) => state.rawResponse);

  if (!outputs) {
    return (
      <div className="p-4 text-sm text-gray-500" aria-live="polite">
        No results yet — run the workflow first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" aria-label="Run results">
      {orderedOutputNames(runSpec, outputs).map((name) => (
        <OutputSection key={name} name={name} value={outputs[name]} />
      ))}
      <details className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-700">
          JSON Output
        </summary>
        <pre
          aria-label="Full run response JSON"
          className="max-h-96 overflow-auto border-t border-gray-100 p-3 font-mono text-[11px] leading-4 text-gray-600"
        >
          {JSON.stringify(rawResponse, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function OutputSection({ name, value }: { name: string; value: unknown }) {
  return (
    <section aria-label={`Workflow output ${name}`}>
      <p className="mb-1 text-xs font-medium text-gray-500">{name}</p>
      <OutputValue value={value} />
    </section>
  );
}

function OutputValue({ value }: { value: unknown }) {
  if (isImageValue(value)) {
    return (
      <img
        src={imageSrc(value)}
        alt={`Workflow output image ${value.width ?? "?"}×${value.height ?? "?"}`}
        className="w-full rounded-lg border border-gray-200"
      />
    );
  }
  if (isPredictionsValue(value)) {
    return <PredictionsTable value={value} />;
  }
  if (isScalarValue(value)) {
    return <p className="text-2xl font-medium text-gray-900">{String(value)}</p>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-[11px] leading-4 text-gray-600">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatCell(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function formatConfidence(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function PredictionsTable({ value }: { value: PredictionsValue }) {
  const items = value.predictions ?? [];
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex w-fit items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary">
        {items.length} {items.length === 1 ? "detection" : "detections"}
      </span>
      {items.length > 0 ? (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-1 pr-2 font-medium">class</th>
              <th className="py-1 pr-2 font-medium">confidence</th>
              <th className="py-1 pr-2 font-medium">x</th>
              <th className="py-1 pr-2 font-medium">y</th>
              <th className="py-1 pr-2 font-medium">w</th>
              <th className="py-1 font-medium">h</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: PredictionItem, index: number) => (
              <tr key={item.detection_id ?? index} className="border-b border-gray-100">
                <td className="py-1 pr-2 text-gray-800">{item.class ?? "—"}</td>
                <td className="py-1 pr-2 text-gray-600">{formatConfidence(item.confidence)}</td>
                <td className="py-1 pr-2 text-gray-600">{formatCell(item.x)}</td>
                <td className="py-1 pr-2 text-gray-600">{formatCell(item.y)}</td>
                <td className="py-1 pr-2 text-gray-600">{formatCell(item.width)}</td>
                <td className="py-1 text-gray-600">{formatCell(item.height)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {value.image?.width !== undefined ? (
        <p className="text-[11px] text-gray-400">
          {value.image.width} × {value.image.height ?? "?"} px
        </p>
      ) : null}
    </div>
  );
}
