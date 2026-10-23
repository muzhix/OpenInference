import { describe, expect, it } from "vitest";

import { blockSectionOf, buildPaletteSections, dedupeToLatestVisible, sectionMetaOf } from "./category";
import { CLOUD_BLOCKS, CLOUD_SECTIONS } from "../registry/cloudSections";

import type { BlockDescriptor } from "../types/registry";

function block(identifier: string, name?: string): BlockDescriptor {
  return {
    manifest_type_identifier: identifier,
    block_schema: { type: "object", properties: {}, required: [] },
    outputs_manifest: [],
  };
}

function cloudBlockFixture(): BlockDescriptor[] {
  return [
    // Cloud-known blocks across several sections.
    block("roboflow_core/roboflow_object_detection_model@v3"), // model, priority 0
    block("roboflow_core/bounding_box_visualization@v1"), // visualization, priority 0
    block("roboflow_core/contrast_equalization@v1"), // classical_cv, priority 5
    block("roboflow_core/contrast_enhancement@v1"), // classical_cv, priority 10
    block("roboflow_core/email_notification@v1"), // notifications, priority 0
    // Local-only block: absent from CLOUD_BLOCKS -> hidden from the palette.
    block("roboflow_core/roboflow_object_detection@v2"),
  ];
}

describe("buildPaletteSections (cloud artifact)", () => {
  it("shows only blocks present in CLOUD_BLOCKS (intersection semantics)", () => {
    const sections = buildPaletteSections(cloudBlockFixture());
    const identifiers = sections.flatMap((section) => section.blocks.map((block) => block.manifest_type_identifier));
    expect(identifiers).not.toContain("roboflow_core/roboflow_object_detection@v2");
    expect(identifiers).toHaveLength(5);
  });

  it("groups into cloud sections in CLOUD_SECTIONS order and skips empty sections", () => {
    const sections = buildPaletteSections(cloudBlockFixture());
    expect(sections.map((section) => section.section)).toEqual([
      "model",
      "visualization",
      "notifications",
      "classical_cv",
    ]);
    const order = CLOUD_SECTIONS.map((section) => section.section);
    const sectionIndexes = sections.map((section) => order.indexOf(section.section));
    expect(sectionIndexes).toEqual([...sectionIndexes].sort((a, b) => a - b));
  });

  it("carries the cloud section label, color, description and icon", () => {
    const sections = buildPaletteSections(cloudBlockFixture());
    const model = sections.find((section) => section.section === "model");
    expect(model?.meta.label).toBe("Model");
    expect(model?.meta.color).toBe("#6D28D9");
    expect(model?.meta.description).toBe("Run a fine-tuned or foundational vision model.");
    expect(model?.meta.icon).toBe("far fa-chart-network");
  });

  it("uses the official builder category labels", () => {
    expect(sectionMetaOf("classical_cv").label).toBe("Classical Computer Vision");
    expect(sectionMetaOf("transformation").label).toBe("Transformation");
    expect(sectionMetaOf("notifications").label).toBe("Notification");
  });

  it("sorts items within a section by cloud priority ascending", () => {
    const sections = buildPaletteSections(cloudBlockFixture());
    const classicalCv = sections.find((section) => section.section === "classical_cv");
    expect(classicalCv?.blocks.map((block) => block.manifest_type_identifier)).toEqual([
      "roboflow_core/contrast_equalization@v1",
      "roboflow_core/contrast_enhancement@v1",
    ]);
  });

  it("filters by name and identifier, case-insensitively", () => {
    const byIdentifier = buildPaletteSections(cloudBlockFixture(), "CONTRAST_ENHANCEMENT");
    expect(byIdentifier.flatMap((section) => section.blocks.map((block) => block.manifest_type_identifier))).toEqual([
      "roboflow_core/contrast_enhancement@v1",
    ]);

    const byName = buildPaletteSections(
      [{ ...block("roboflow_core/contrast_enhancement@v1"), block_schema: { type: "object", name: "Contrast Enhancement", properties: {}, required: [] } }],
      "enhance",
    );
    expect(byName).toHaveLength(1);
    expect(byName[0]!.blocks).toHaveLength(1);
  });
});

describe("dedupeToLatestVisible (official listing rule)", () => {
  it("keeps only the latest version of each block family", () => {
    const blocks = [
      block("roboflow_core/roboflow_object_detection_model@v1"),
      block("roboflow_core/roboflow_object_detection_model@v2"),
      block("roboflow_core/roboflow_object_detection_model@v3"),
      block("roboflow_core/bounding_box_visualization@v1"),
    ];
    const identifiers = dedupeToLatestVisible(blocks).map((block) => block.manifest_type_identifier);
    expect(identifiers).toEqual([
      "roboflow_core/roboflow_object_detection_model@v3",
      "roboflow_core/bounding_box_visualization@v1",
    ]);
  });

  it("hides families whose versions are all deprecated", () => {
    const deprecated = (identifier: string): BlockDescriptor => ({
      ...block(identifier),
      block_schema: { type: "object", properties: {}, required: [], deprecated: true },
    });
    const blocks = [
      deprecated("roboflow_core/byte_tracker@v1"),
      deprecated("roboflow_core/byte_tracker@v2"),
      deprecated("roboflow_core/byte_tracker@v3"),
      block("roboflow_core/trackers_bytetrack@v1"),
    ];
    expect(dedupeToLatestVisible(blocks).map((b) => b.manifest_type_identifier)).toEqual([
      "roboflow_core/trackers_bytetrack@v1",
    ]);
  });

  it("keeps a family whose latest version is not deprecated even if older ones are", () => {
    const deprecated = (identifier: string): BlockDescriptor => ({
      ...block(identifier),
      block_schema: { type: "object", properties: {}, required: [], deprecated: true },
    });
    const blocks = [deprecated("roboflow_core/anthropic_claude@v4"), block("roboflow_core/anthropic_claude@v5")];
    expect(buildPaletteSections(blocks).flatMap((s) => s.blocks.map((b) => b.manifest_type_identifier))).toEqual([
      "roboflow_core/anthropic_claude@v5",
    ]);
  });
});

describe("blockSectionOf / sectionMetaOf", () => {
  it("maps cloud identifiers to their section and unknowns to the fallback", () => {
    expect(blockSectionOf("roboflow_core/contrast_enhancement@v1")).toBe("classical_cv");
    expect(blockSectionOf("roboflow_core/roboflow_object_detection@v2")).toBe("other");
    expect(sectionMetaOf("classical_cv").color).toBe(CLOUD_BLOCKS["roboflow_core/contrast_enhancement@v1"] ? "#06B6D4" : "");
    expect(sectionMetaOf("other").label).toBe("Other");
    expect(sectionMetaOf("other").color).toBe("#6B7280");
    expect(sectionMetaOf("other").description).toBeTruthy();
    expect(sectionMetaOf("other").icon).toBeTruthy();
  });

  it("matches the official full-library category set and ordering", () => {
    expect(CLOUD_SECTIONS.map((section) => section.label)).toEqual([
      "Model",
      "Visualization",
      "Logic and Branching",
      "Data Storage",
      "Notification",
      "Video",
      "Transformation",
      "Classical Computer Vision",
      "Advanced",
      "Industrial Integration",
      "Custom",
    ]);
  });

  it("files the Custom-category blocks and hides officially-hidden families", () => {
    expect(blockSectionOf("roboflow_core/detection_event_log@v1")).toBe("custom");
    expect(blockSectionOf("roboflow_core/overlap_analysis@v1")).toBe("custom");
    // Official full library shows no card for these families (2026-10-23).
    expect(CLOUD_BLOCKS["roboflow_core/vlm_as_detector@v1"]).toBeUndefined();
    expect(CLOUD_BLOCKS["roboflow_core/vlm_as_classifier@v2"]).toBeUndefined();
    expect(CLOUD_BLOCKS["roboflow_core/seg-preview@v1"]).toBeUndefined();
  });
});
