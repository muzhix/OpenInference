/** Canvas sticky note (metadata.ui.notes), editable in place. */

import { useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";

import type { AppNode } from "../../../adapter";
import { useEditorStore } from "../../../state/editorStore";
import { CloseIcon } from "../icons";

export function StickyNoteNode(props: NodeProps<AppNode>) {
  const { id, data, selected } = props;
  const updateNoteText = useEditorStore((state) => state.updateNoteText);
  const deleteNote = useEditorStore((state) => state.deleteNote);
  const [text, setText] = useState(data.kind === "note" ? data.note.text : "");

  useEffect(() => {
    if (data.kind === "note") {
      setText(data.note.text);
    }
  }, [data]);

  if (data.kind !== "note") {
    return null;
  }

  return (
    <div
      className={`relative w-[200px] rounded-md border bg-amber-50 p-2 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${
        selected ? "border-amber-500" : "border-amber-200"
      }`}
    >
      <textarea
        aria-label="Sticky note text"
        value={text}
        rows={4}
        placeholder="Add note…"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text !== data.note.text) {
            updateNoteText(data.note.id, text);
          }
        }}
        className="nodrag nowheel w-full resize-none bg-transparent text-xs text-gray-700 focus:outline-none"
      />
      <button
        type="button"
        aria-label="Delete note"
        title="Delete note"
        onClick={() => deleteNote(data.note.id)}
        className="absolute right-1 top-1 rounded p-0.5 text-gray-400 hover:bg-amber-100 hover:text-gray-700"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
