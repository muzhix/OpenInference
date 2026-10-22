/**
 * Blocks palette: the official builder's fixed left-side two-level popup.
 * Level 1 lists categories (icon + name + one-line description + chevron),
 * level 2 lists that category's blocks (icon + name + description + category
 * tag), the bottom "View All Blocks" link opens the flat list of every block,
 * and the search box filters across all blocks from any view. The panel is
 * anchored to the canvas edges (not draggable), mirroring the cloud builder.
 */

import { useEffect, useMemo, useState } from "react";

import { blockDisplayName, buildPaletteSections, faClasses, sectionMetaOf } from "../../adapter";
import type { PaletteSection } from "../../adapter";
import { useEditorStore } from "../../state/editorStore";
import { useRegistryStore } from "../../state/registryStore";
import type { BlockDescriptor } from "../../types/registry";

type PaletteView = { kind: "categories" } | { kind: "section"; section: string } | { kind: "all" };

export function BlocksPalette() {
  const palette = useEditorStore((state) => state.palette);
  const closePalette = useEditorStore((state) => state.closePalette);
  const addBlock = useEditorStore((state) => state.addBlock);
  const registry = useRegistryStore((state) => state.registry);
  const registryStatus = useRegistryStore((state) => state.status);
  const [view, setView] = useState<PaletteView>({ kind: "categories" });
  const [query, setQuery] = useState("");

  // Each reopen starts fresh at the category list (cloud behavior).
  useEffect(() => {
    if (palette) {
      setView({ kind: "categories" });
      setQuery("");
    }
  }, [palette]);

  const sections: PaletteSection[] = useMemo(
    () => (registry ? buildPaletteSections(registry.blocks, query) : []),
    [registry, query],
  );
  const searching = query.trim().length > 0;

  const activeSection = view.kind === "section" ? sections.find((section) => section.section === view.section) : undefined;
  const listedBlocks: { block: BlockDescriptor; section: string; showTag: boolean }[] = searching
    ? sections.flatMap((section) => section.blocks.map((block) => ({ block, section: section.section, showTag: false })))
    : view.kind === "section" && activeSection
      ? activeSection.blocks.map((block) => ({ block, section: activeSection.section, showTag: true }))
      : view.kind === "all"
        ? sections.flatMap((section) => section.blocks.map((block) => ({ block, section: section.section, showTag: false })))
        : [];
  const showBack = !searching && view.kind !== "categories";
  const showViewAll = !searching && view.kind !== "all";

  if (!palette) {
    return null;
  }

  return (
    <div
      className="absolute bottom-4 left-4 top-16 z-40 flex w-96 flex-col rounded-xl border border-gray-200 bg-white shadow-lg"
      role="dialog"
      aria-label="Blocks palette"
    >
      <div className="flex items-center justify-between gap-1 px-4 pb-2 pt-3">
        <h2 className="text-base font-medium text-gray-800">Workflow Blocks</h2>
        <button
          type="button"
          aria-label="Close blocks palette"
          onClick={closePalette}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <i className={`${faClasses("far fa-times")} text-sm`} aria-hidden="true" />
        </button>
      </div>
      <div className="px-4 pb-2">
        <input
          id="add-block-searchbar"
          type="text"
          aria-label="Search blocks"
          placeholder="Search workflow blocks"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (query) {
                setQuery("");
              } else {
                closePalette();
              }
            }
          }}
          autoFocus
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto px-2 pb-1">
          {showBack ? (
            <button
              type="button"
              aria-label="Back to categories"
              onClick={() => setView({ kind: "categories" })}
              className="sticky top-0 z-10 -mx-2 mb-1 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-2 border-b border-gray-100 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <i className={faClasses("far fa-chevron-left")} aria-hidden="true" />
              {view.kind === "section" ? sectionMetaOf(view.section).label : "Back"}
            </button>
          ) : null}
          {registryStatus === "loading" && !registry ? (
            <p className="px-2 py-4 text-xs text-gray-500">Loading blocks…</p>
          ) : null}
          {registryStatus === "error" && !registry ? (
            <p className="px-2 py-4 text-xs text-danger">Failed to load the block registry.</p>
          ) : null}
          {registry && !searching && view.kind === "categories"
            ? sections.map(({ section, meta }) => (
                <CategoryRow key={section} section={section} onSelect={() => setView({ kind: "section", section })} />
              ))
            : null}
          {registry && (searching || view.kind !== "categories") && listedBlocks.length === 0 ? (
            <p className="px-2 py-4 text-xs text-gray-500">
              {searching ? `No blocks match “${query}”.` : "No blocks in this category."}
            </p>
          ) : null}
          {listedBlocks.map(({ block, section, showTag }) => (
            <BlockRow key={block.manifest_type_identifier} block={block} section={section} showTag={showTag} onAdd={addBlock} />
          ))}
        </div>
        {showViewAll ? (
          <button
            type="button"
            onClick={() => setView({ kind: "all" })}
            className="absolute bottom-0 left-0 right-0 flex cursor-pointer justify-center border-t border-gray-200 bg-white py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
          >
            View All Blocks
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CategoryRow({ section, onSelect }: { section: string; onSelect: () => void }) {
  const meta = sectionMetaOf(section);
  return (
    <button
      type="button"
      aria-label={`Browse ${meta.label} blocks`}
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-100"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: meta.tint, color: meta.color }}
      >
        <i className={faClasses(meta.icon)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-800">{meta.label}</span>
        <span className="block truncate text-xs text-gray-500">{meta.description}</span>
      </span>
      <i className={`${faClasses("far fa-chevron-right")} shrink-0 text-xs text-gray-400`} aria-hidden="true" />
    </button>
  );
}

function BlockRow({
  block,
  section,
  showTag,
  onAdd,
}: {
  block: BlockDescriptor;
  section: string;
  showTag: boolean;
  onAdd: (manifestType: string) => void;
}) {
  const meta = sectionMetaOf(section);
  const name = blockDisplayName(block);
  const description = block.block_schema?.short_description ?? block.manifest_type_identifier;
  const icon = block.block_schema?.ui_manifest?.icon;
  return (
    <button
      type="button"
      aria-label={`Add block ${name}`}
      data-testid="blockListItem"
      data-block-type={block.manifest_type_identifier}
      title={description}
      onClick={() => onAdd(block.manifest_type_identifier)}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-100"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: meta.tint, color: meta.color }}
      >
        <i className={faClasses(icon)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium capitalize text-gray-800">{name}</span>
          {showTag ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              {meta.label}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-gray-500">{description}</span>
      </span>
    </button>
  );
}
