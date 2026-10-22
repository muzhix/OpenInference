/**
 * Cloud-section block categorization for the palette and node accents, driven
 * by the generated cloud artifact (src/registry/cloudSections.ts) instead of
 * keyword heuristics. The palette shows ONLY blocks present in CLOUD_BLOCKS
 * (local registry ⊆ cloud registry); node accents fall back to gray for blocks
 * the cloud registry does not know.
 */

import { CLOUD_BLOCKS, CLOUD_SECTIONS } from "../registry/cloudSections";

import type { BlockDescriptor } from "../types/registry";

export interface SectionMeta {
  label: string;
  /** Node-card left accent + palette icon glyph color. */
  color: string;
  /** Light chip background behind the colored icon glyph. */
  tint: string;
  /** One-line description shown in the palette's level-1 category list. */
  description: string;
  /** FontAwesome classes for the category icon. */
  icon: string;
}

/** Section id used when a block has no cloud entry (accents only; never in the palette). */
export const FALLBACK_SECTION = "other";

const FALLBACK_SECTION_META: SectionMeta = {
  label: "Other",
  color: "#6B7280",
  tint: "#F3F4F6",
  description: "Blocks outside the cloud registry.",
  icon: "far fa-cube",
};

/** Cloud section ids in palette order (model first, formatter last). */
export const SECTION_ORDER: string[] = CLOUD_SECTIONS.map((section) => section.section);

export function sectionMetaOf(section: string): SectionMeta {
  return CLOUD_SECTIONS.find((candidate) => candidate.section === section) ?? FALLBACK_SECTION_META;
}

/** Cloud section of a block identifier; FALLBACK_SECTION when the cloud registry lacks it. */
export function blockSectionOf(manifestTypeIdentifier: string): string {
  return CLOUD_BLOCKS[manifestTypeIdentifier]?.section ?? FALLBACK_SECTION;
}

/** Human display name for a block: block_schema.name, else manifest short name. */
export function blockDisplayName(block: BlockDescriptor): string {
  return block.block_schema?.name ?? blockDisplayNameFromIdentifier(block.manifest_type_identifier);
}

/** "roboflow_core/roboflow_label_visualization@v1" -> "label_visualization". */
export function blockShortName(manifestTypeIdentifier: string): string {
  const withoutVersion = manifestTypeIdentifier.split("@")[0] ?? manifestTypeIdentifier;
  const segments = withoutVersion.split("/");
  const last = segments[segments.length - 1] ?? withoutVersion;
  const stripped = last.replace(/^roboflow_/, "");
  return stripped || withoutVersion;
}

function blockDisplayNameFromIdentifier(identifier: string): string {
  return blockShortName(identifier).replace(/_/g, " ");
}

export interface PaletteSection {
  section: string;
  meta: SectionMeta;
  blocks: BlockDescriptor[];
}

/** "roboflow_core/x@v3" -> "roboflow_core/x"; versionless ids stay whole. */
function familyOf(manifestTypeIdentifier: string): string {
  return manifestTypeIdentifier.replace(/@v\d+$/, "");
}

/** "roboflow_core/x@v3" -> 3; versionless -> 0. */
function versionOf(manifestTypeIdentifier: string): number {
  const match = /@v(\d+)$/.exec(manifestTypeIdentifier);
  return match ? Number(match[1]) : 0;
}

/**
 * Official palette listing rule (observed on the live builder, 2026-10-21):
 * a block family (identifier without @vN) appears at most once — its LATEST
 * available version — and a family whose latest version is marked deprecated
 * in block_schema is hidden entirely (e.g. byte_tracker is fully deprecated
 * and superseded by trackers_bytetrack, so it never shows).
 */
export function dedupeToLatestVisible(blocks: BlockDescriptor[]): BlockDescriptor[] {
  const latestByFamily = new Map<string, BlockDescriptor>();
  for (const block of blocks) {
    if (block.block_schema?.deprecated === true) {
      continue;
    }
    const family = familyOf(block.manifest_type_identifier);
    const current = latestByFamily.get(family);
    if (!current || versionOf(block.manifest_type_identifier) > versionOf(current.manifest_type_identifier)) {
      latestByFamily.set(family, block);
    }
  }
  return [...latestByFamily.values()];
}

/**
 * Build the palette sections for a registry block list: keep only blocks with
 * a CLOUD_BLOCKS entry, reduce each family to its latest non-deprecated
 * version, filter by name/identifier substring (case-insensitive), group by
 * cloud section in CLOUD_SECTIONS order (empty sections skipped) and sort each
 * section by cloud priority ascending, then display name.
 */
export function buildPaletteSections(blocks: BlockDescriptor[], query = ""): PaletteSection[] {
  const needle = query.trim().toLowerCase();
  const grouped = new Map<string, BlockDescriptor[]>();
  for (const block of dedupeToLatestVisible(blocks)) {
    const cloud = CLOUD_BLOCKS[block.manifest_type_identifier];
    if (!cloud) {
      continue;
    }
    if (needle) {
      const haystack = `${blockDisplayName(block)}\n${block.manifest_type_identifier}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
    }
    const list = grouped.get(cloud.section) ?? [];
    list.push(block);
    grouped.set(cloud.section, list);
  }

  const sections: PaletteSection[] = [];
  for (const section of CLOUD_SECTIONS) {
    const blocksInSection = grouped.get(section.section);
    if (!blocksInSection || blocksInSection.length === 0) {
      continue;
    }
    sections.push({
      section: section.section,
      meta: {
        label: section.label,
        color: section.color,
        tint: section.tint,
        description: section.description,
        icon: section.icon,
      },
      blocks: sortBlocksForCloudPalette(blocksInSection),
    });
  }
  return sections;
}

/** Sort blocks within a palette section: cloud priority asc, then display name, then identifier. */
export function sortBlocksForCloudPalette(blocks: BlockDescriptor[]): BlockDescriptor[] {
  return [...blocks].sort((a, b) => {
    const priorityA = CLOUD_BLOCKS[a.manifest_type_identifier]?.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = CLOUD_BLOCKS[b.manifest_type_identifier]?.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    const byName = blockDisplayName(a).localeCompare(blockDisplayName(b));
    if (byName !== 0) {
      return byName;
    }
    return a.manifest_type_identifier.localeCompare(b.manifest_type_identifier);
  });
}
