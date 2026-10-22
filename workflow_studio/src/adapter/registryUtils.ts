/** Registry lookup helpers shared by the adapter and components. */

import type { BlockDescriptor, BlockRegistry, OutputManifestEntry } from "../types/registry";

/**
 * Property names that hold selector references even when kinds_connections is
 * unavailable; per measured specs these param names are always selectors.
 */
export const HEURISTIC_SELECTOR_PROPERTIES: ReadonlySet<string> = new Set([
  "images",
  "image",
  "predictions",
  "classes",
  "reference_image",
]);

export function findBlock(
  registry: BlockRegistry | null | undefined,
  manifestType: string,
): BlockDescriptor | null {
  if (!registry) {
    return null;
  }
  for (const block of registry.blocks) {
    if (block.manifest_type_identifier === manifestType) {
      return block;
    }
  }
  return null;
}

export function blockOutputs(
  registry: BlockRegistry | null | undefined,
  manifestType: string,
): OutputManifestEntry[] {
  const block = findBlock(registry, manifestType);
  return block?.outputs_manifest ?? [];
}

/** Property names of a block that accept selector inputs (kind connections + heuristics). */
export function selectorPropertiesForBlock(
  registry: BlockRegistry | null | undefined,
  manifestType: string,
): string[] {
  const names = new Set<string>();
  if (registry) {
    for (const entries of Object.values(registry.kinds_connections)) {
      for (const entry of entries) {
        if (entry.manifest_type_identifier === manifestType) {
          names.add(entry.property_name);
        }
      }
    }
  }
  for (const name of HEURISTIC_SELECTOR_PROPERTIES) {
    names.add(name);
  }
  return [...names].sort();
}

/**
 * The block's primary image input property: a selector property accepting the
 * "image" kind (used by addStep auto-binding). Prefers `image`, then `images`,
 * then the first match.
 */
export function imageInputPropertyForBlock(
  registry: BlockRegistry | null | undefined,
  manifestType: string,
): string | null {
  if (!registry) {
    return null;
  }
  const candidates: string[] = [];
  for (const [kindName, entries] of Object.entries(registry.kinds_connections)) {
    const isImageKind = kindName === "image" || kindName.endsWith("/image") || kindName === "WorkflowImage";
    if (!isImageKind) {
      continue;
    }
    for (const entry of entries) {
      if (entry.manifest_type_identifier === manifestType) {
        candidates.push(entry.property_name);
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const preferred = ["image", "images"].find((name) => candidates.includes(name));
  return preferred ?? candidates[0]!;
}
