/** Minimal 16px stroke icons (currentColor). */

import type { ReactNode } from "react";

function Svg({ children, label }: { children: ReactNode; label?: string }) {
  void label;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const UndoIcon = () => (
  <Svg><path d="M3 7h6a3.5 3.5 0 1 1 0 7H6" /><path d="M3 7l3-3M3 7l3 3" /></Svg>
);
export const RedoIcon = () => (
  <Svg><path d="M13 7H7a3.5 3.5 0 1 0 0 7h3" /><path d="M13 7l-3-3M13 7l-3 3" /></Svg>
);
export const ZoomInIcon = () => (
  <Svg><circle cx="7" cy="7" r="4.5" /><path d="M14 14l-3.2-3.2M7 5v4M5 7h4" /></Svg>
);
export const ZoomOutIcon = () => (
  <Svg><circle cx="7" cy="7" r="4.5" /><path d="M14 14l-3.2-3.2M5 7h4" /></Svg>
);
export const FitViewIcon = () => (
  <Svg><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" /></Svg>
);
export const LayoutIcon = () => (
  <Svg><rect x="2" y="2" width="4" height="5" /><rect x="10" y="2" width="4" height="5" /><rect x="6" y="9" width="4" height="5" /><path d="M4 7v2h4M12 7V9H8" /></Svg>
);
export const PlusIcon = () => <Svg><path d="M8 3v10M3 8h10" /></Svg>;
export const LockIcon = () => (
  <Svg><rect x="3.5" y="7" width="9" height="6" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></Svg>
);
export const UnlockIcon = () => (
  <Svg><rect x="3.5" y="7" width="9" height="6" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-1" /></Svg>
);
export const MapIcon = () => (
  <Svg><path d="M2 4l4-1.5L10 4l4-1.5v9.5L10 13.5 6 12l-4 1.5z" /><path d="M6 2.5V12M10 4v9.5" /></Svg>
);
export const TrashIcon = () => (
  <Svg><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9" /></Svg>
);
export const NoteIcon = () => (
  <Svg><path d="M3 3h10v7l-3 3H3z" /><path d="M13 10h-3v3" /></Svg>
);
export const PencilIcon = () => (
  <Svg><path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" /></Svg>
);
export const BracesIcon = () => (
  <Svg><path d="M6 2.5C4 2.5 4.5 6 3 6.5v3C4.5 10 4 13.5 6 13.5M10 2.5c2 0 1.5 3.5 3 4v3c-1.5.5-1 4-3 4" /></Svg>
);
export const EyeOffIcon = () => (
  <Svg><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><path d="M2 2l12 12" /></Svg>
);
export const CloseIcon = () => <Svg><path d="M4 4l8 8M12 4l-8 8" /></Svg>;
export const ClockIcon = () => (
  <Svg><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></Svg>
);
export const SearchIcon = () => (
  <Svg><circle cx="7" cy="7" r="4.5" /><path d="M14 14l-3.2-3.2" /></Svg>
);
