import { describe, expect, it } from "vitest";

import type { WorkflowSpecification } from "../../types/spec";
import {
  buildRunInputs,
  deriveStepThumbnails,
  extractRunErrorMessage,
  isImageValue,
  isPredictionsValue,
  isScalarValue,
  orderedOutputNames,
  stripDataUrlPrefix,
} from "./runUtils";

describe("stripDataUrlPrefix", () => {
  it("strips the data-url prefix from base64 payloads", () => {
    expect(stripDataUrlPrefix("data:image/jpeg;base64,aGVsbG8=")).toBe("aGVsbG8=");
    expect(stripDataUrlPrefix("data:image/png;base64,AAA")).toBe("AAA");
  });

  it("passes plain base64 values through unchanged", () => {
    expect(stripDataUrlPrefix("aGVsbG8=")).toBe("aGVsbG8=");
  });
});

describe("buildRunInputs", () => {
  it("builds the base64 descriptor without the data-url prefix and without validUrl", () => {
    const inputs = buildRunInputs({
      kind: "base64",
      value: "aGVsbG8=",
      dataUrl: "data:image/jpeg;base64,aGVsbG8=",
      fileName: "test.jpg",
    });
    expect(inputs).toEqual({
      image: { mediaType: "image", type: "base64", value: "aGVsbG8=", videoType: "file" },
    });
    expect("validUrl" in inputs.image).toBe(false);
  });

  it("omits validUrl for URL inputs whose precheck did not succeed", () => {
    const inputs = buildRunInputs({ kind: "url", value: "https://example.com/a.jpg" });
    expect(inputs).toEqual({
      image: { mediaType: "image", type: "url", value: "https://example.com/a.jpg", videoType: "file" },
    });
    expect("validUrl" in inputs.image).toBe(false);
  });

  it("includes validUrl only when the URL precheck succeeded", () => {
    const inputs = buildRunInputs({ kind: "url", value: "https://example.com/a.jpg", validUrl: true });
    expect(inputs.image).toEqual({
      mediaType: "image",
      type: "url",
      value: "https://example.com/a.jpg",
      videoType: "file",
      validUrl: true,
    });
  });
});

describe("result value classification", () => {
  it("recognizes engine image values (base64 descriptors) only", () => {
    expect(isImageValue({ type: "base64", value: "AAA" })).toBe(true);
    expect(isImageValue({ type: "url", value: "https://x/y.jpg" })).toBe(false);
    expect(isImageValue({ type: "base64", value: 42 })).toBe(false);
    expect(isImageValue("base64")).toBe(false);
    expect(isImageValue(null)).toBe(false);
  });

  it("recognizes predictions values by their predictions array", () => {
    expect(isPredictionsValue({ predictions: [] })).toBe(true);
    expect(isPredictionsValue({ image: { width: 10 }, predictions: [{ class: "a" }] })).toBe(true);
    expect(isPredictionsValue({ image: { width: 10 } })).toBe(false);
    expect(isPredictionsValue([1, 2])).toBe(false);
  });

  it("classifies numbers, booleans and short strings as scalars", () => {
    expect(isScalarValue(3)).toBe(true);
    expect(isScalarValue(1.5)).toBe(true);
    expect(isScalarValue(true)).toBe(true);
    expect(isScalarValue("ok")).toBe(true);
    expect(isScalarValue("a".repeat(200))).toBe(false);
    expect(isScalarValue({ predictions: [] })).toBe(false);
    expect(isScalarValue(null)).toBe(false);
  });
});

describe("deriveStepThumbnails", () => {
  const spec: WorkflowSpecification = {
    version: "1.0",
    inputs: [{ type: "WorkflowImage", name: "image" }],
    steps: [
      { type: "roboflow_core/contrast_enhancement@v1", name: "enhance" },
      { type: "roboflow_core/object_detection@v1", name: "detect" },
    ],
    outputs: [
      { type: "JsonField", name: "output_image", selector: "$steps.enhance.image" },
      { type: "JsonField", name: "predictions", selector: "$steps.detect.predictions" },
      { type: "JsonField", name: "input_copy", selector: "$inputs.image" },
    ],
  };

  it("maps image outputs to the step referenced by the selector", () => {
    const outputs = {
      output_image: { type: "base64", value: "XYZ" },
      predictions: { predictions: [] },
      input_copy: { type: "base64", value: "SHOULD-NOT-MAP" },
    };
    expect(deriveStepThumbnails(spec, outputs)).toEqual({
      enhance: "data:image/jpeg;base64,XYZ",
    });
  });

  it("ignores selectors that point at workflow inputs or non-image values", () => {
    expect(deriveStepThumbnails(spec, { predictions: { predictions: [] } })).toEqual({});
    expect(deriveStepThumbnails(spec, { output_image: 5, input_copy: { type: "base64", value: "A" } })).toEqual({});
  });
});

describe("extractRunErrorMessage", () => {
  it("prefers errors[0].message from the payload of API errors", () => {
    const error = Object.assign(new Error("fallback"), {
      payload: { errors: [{ code: "execution_error", message: "Engine exploded" }] },
    });
    expect(extractRunErrorMessage(error)).toBe("Engine exploded");
  });

  it("falls back to the error message", () => {
    expect(extractRunErrorMessage(new Error("plain"))).toBe("plain");
    expect(extractRunErrorMessage("oops")).toBe("oops");
  });
});

describe("orderedOutputNames", () => {
  it("orders response keys by spec outputs first, then extras", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [],
      steps: [],
      outputs: [
        { type: "JsonField", name: "b", selector: "$steps.x.b" },
        { type: "JsonField", name: "a", selector: "$steps.x.a" },
      ],
    };
    expect(orderedOutputNames(spec, { a: 1, b: 2, extra: 3 })).toEqual(["b", "a", "extra"]);
    expect(orderedOutputNames(null, { z: 1 })).toEqual(["z"]);
  });
});
