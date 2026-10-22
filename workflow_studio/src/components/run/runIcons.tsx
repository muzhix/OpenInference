/** 16px stroke icons local to the run panel (currentColor). */

import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
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

export const ExpandIcon = () => (
  <Svg><path d="M9 2h5v5M7 14H2V9M14 2l-5 5M2 14l5-5" /></Svg>
);

export const FullscreenIcon = () => (
  <Svg><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></Svg>
);

export const GearIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" />
  </Svg>
);

export const ChevronIcon = () => <Svg><path d="M4 6l4 4 4-4" /></Svg>;
