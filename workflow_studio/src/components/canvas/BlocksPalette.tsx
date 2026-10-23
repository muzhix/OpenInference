/**
 * Blocks palette: the official builder's fixed two-level popup. The canvas
 * + button anchors it on the left ("Workflow Blocks"). Inserting on a
 * connection anchors it on the right ("Add Block", All / Custom).
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
import { UiIcon } from "./hollowIcons";
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
  const [library, setLibrary] = useState<"all" | "custom">("all");
  const side = palette?.side ?? "left";

  // Each reopen starts fresh at the category list (cloud behavior).
  useEffect(() => {
    if (palette) {
      setView({ kind: "categories" });
      setQuery("");
      setLibrary("all");
    }
  }, [palette]);

  const sections: PaletteSection[] = useMemo(
    () => (registry ? buildPaletteSections(registry.blocks, query) : []),
    [registry, query],
  );
  const listedSections = side === "right" && library === "custom"
    ? sections.filter((section) => section.section === "custom")
    : sections;
  const searching = query.trim().length > 0;

  const activeSection = view.kind === "section" ? listedSections.find((section) => section.section === view.section) : undefined;
  const listedBlocks: { block: BlockDescriptor; section: string; showTag: boolean }[] = searching
    ? listedSections.flatMap((section) => section.blocks.map((block) => ({ block, section: section.section, showTag: false })))
    : view.kind === "section" && activeSection
      ? activeSection.blocks.map((block) => ({ block, section: activeSection.section, showTag: true }))
      : view.kind === "all"
        ? listedSections.flatMap((section) => section.blocks.map((block) => ({ block, section: section.section, showTag: false })))
        : [];
  const showBack = !searching && view.kind !== "categories";
  const showViewAll = !searching && view.kind !== "all";

  if (!palette) {
    return null;
  }

  return (
    <div
      className={`absolute bottom-4 top-16 z-40 flex w-96 flex-col rounded-xl border border-gray-200 bg-white shadow-lg ${
        side === "right" ? "right-4" : "left-4"
      }`}
      role="dialog"
      aria-label="Blocks palette"
    >
      <div className="flex items-center justify-between gap-1 px-4 pb-2 pt-3">
        <h2 className="text-base font-medium text-gray-800">{side === "right" ? "Add Block" : "Workflow Blocks"}</h2>
        <button
          type="button"
          aria-label="Close blocks palette"
          onClick={closePalette}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <UiIcon name="x" className="text-sm" />
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
      {side === "right" ? (
        <div className="flex gap-1 px-4 pb-2">
          <button
            type="button"
            aria-pressed={library === "all"}
            onClick={() => {
              setLibrary("all");
              setView({ kind: "categories" });
            }}
            className={`rounded-md px-2.5 py-1 text-sm font-medium ${
              library === "all" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={library === "custom"}
            onClick={() => {
              setLibrary("custom");
              setView({ kind: "categories" });
            }}
            className={`rounded-md px-2.5 py-1 text-sm font-medium ${
              library === "custom" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Custom
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
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
            ? listedSections.map(({ section, meta }) => (
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
            className="flex shrink-0 cursor-pointer justify-center border-t border-gray-200 bg-white py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
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
      <UiIcon name="chevron-right" className="shrink-0 text-sm text-gray-400" />
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
