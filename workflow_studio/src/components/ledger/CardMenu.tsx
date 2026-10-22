/** Card ⋯ dropdown / right-click menu (01 §4b): Favorite (placeholder), Duplicate, Rename, Move to Trash. */

import { useEffect, useRef } from "react";

export interface CardMenuActions {
  onDuplicate: () => void;
  onRename: () => void;
  onTrash: () => void;
}

export function CardMenu({
  onClose,
  actions,
}: {
  onClose: () => void;
  actions: CardMenuActions;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const run = (action: () => void): void => {
    onClose();
    action();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Workflow actions"
      className="absolute right-2 top-10 z-30 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MenuItem disabled disabledReason="Favorites are not available yet">
        Favorite Workflow
      </MenuItem>
      <MenuItem onClick={() => run(actions.onDuplicate)}>Duplicate Workflow</MenuItem>
      <MenuItem onClick={() => run(actions.onRename)}>Rename Workflow…</MenuItem>
      <div aria-hidden="true" className="my-1 border-t border-gray-100" />
      <MenuItem danger onClick={() => run(actions.onTrash)}>
        Move to Trash
      </MenuItem>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  disabledReason,
  danger = false,
}: {
  children: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled ? "true" : undefined}
      title={disabled ? disabledReason : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onClick?.();
        }
      }}
      className={`block w-full px-3 py-1.5 text-left text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed text-gray-300"
          : danger
            ? "text-[#DC2626] hover:bg-red-50"
            : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
