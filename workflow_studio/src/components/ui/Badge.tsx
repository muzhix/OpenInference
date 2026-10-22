/** Small status pill (Draft/Published/errors). */

import type { ReactNode } from "react";

type BadgeTone = "gray" | "green" | "amber" | "red" | "purple";

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-green-100 text-[#15803D]",
  amber: "bg-amber-100 text-[#B45309]",
  red: "bg-red-100 text-[#B91C1C]",
  purple: "bg-primary-50 text-primary",
};

export function Badge({
  tone = "gray",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[tone]}`}
      title={title}
    >
      {children}
    </span>
  );
}
