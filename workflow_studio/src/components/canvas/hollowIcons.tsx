/**
 * UI chrome icons — Lucide (the icon set shadcn/ui uses) via lucide-react.
 * The official builder renders chrome icons in thin outline style, which
 * FontAwesome's free tier cannot provide; registry block icons
 * (ui_manifest) stay FontAwesome solid, everything chrome-level is Lucide.
 *
 * lucide-react 1.x dropped the deprecated aliases (HelpCircle → CircleHelp,
 * Edit → Pencil, ...) and some duplicated names (Sitemap → Network,
 * Cubes → Boxes); only canonical names are imported below. UiIcon keeps a
 * string-name API so call sites never import icon components directly.
 */

import {
  ArrowDownFromLine,
  ArrowDownToLine,
  ArrowUpFromLine,
  Asterisk,
  Ban,
  BookOpen,
  Box,
  Boxes,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Database,
  Expand,
  IdCard,
  Image as ImageIcon,
  Info,
  Lock,
  LockOpen,
  Map as MapIcon,
  Minus,
  Move,
  Network,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  StickyNote,
  Trash2,
  TriangleAlert,
  Undo2,
  Redo2,
  Video as VideoIcon,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  help: CircleHelp,
  info: Info,
  book: BookOpen,
  braces: Braces,
  play: Play,
  edit: Pencil,
  "note-sticky": StickyNote,
  ban: Ban,
  trash: Trash2,
  undo: Undo2,
  redo: Redo2,
  sitemap: Network,
  network: Share2,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  minus: Minus,
  plus: Plus,
  x: X,
  "lock-open": LockOpen,
  lock: Lock,
  expand: Expand,
  map: MapIcon,
  "arrow-down-to-line": ArrowDownToLine,
  "arrow-down-from-line": ArrowDownFromLine,
  "arrow-up-from-line": ArrowUpFromLine,
  image: ImageIcon,
  "id-card": IdCard,
  video: VideoIcon,
  database: Database,
  search: Search,
  check: Check,
  sliders: SlidersHorizontal,
  star: Star,
  cubes: Boxes,
  move: Move,
  asterisk: Asterisk,
  box: Box,
  alert: TriangleAlert,
};

export type HollowIconName = keyof typeof ICONS;

/** Map workflow input types to lucide icon names. */
/** Kind-aware chip icon: inference id, model id, image, otherwise a generic box. */
export function outputFieldIconName(outputName: string, kindName?: string): string {
  const blob = `${kindName ?? ""} ${outputName}`.toLowerCase();
  if (blob.includes("inference_id")) {
    return "id-card";
  }
  if (outputName === "all_properties" || blob.includes("model_id")) {
    return "sitemap";
  }
  if (outputName === "image" || kindName === "image") {
    return "image";
  }
  if (outputName === "*") {
    return "asterisk";
  }
  return "box";
}

export function inputTypeIconName(type: string): string {
  if (type === "WorkflowVideoMetadata" || type === "WorkflowVideo" || type === "InferenceVideo") {
    return "video";
  }
  if (type === "WorkflowParameter" || type === "InferenceParameter") {
    return "sliders";
  }
  if (type === "WorkflowData" || type === "InferenceData") {
    return "database";
  }
  return "image";
}

export function UiIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = ICONS[name] ?? Box;
  return (
    <IconComponent
      aria-hidden="true"
      className={className}
      strokeWidth={1.75}
      style={{ width: "1em", height: "1em" }}
    />
  );
}
