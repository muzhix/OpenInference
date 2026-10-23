/** Skeleton card shown in the gap while the user picks a block to insert. */

import { STEP_CARD_HEIGHT } from "../../../adapter";
import { UiIcon } from "../hollowIcons";
import { BottomSourceHandle, TopTargetHandle } from "./shared";

export function InsertPlaceholderNode() {
  return (
    <div
      className="relative box-border flex w-[280px] items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 shadow-sm"
      style={{ height: STEP_CARD_HEIGHT }}
      aria-label="Insert block placeholder"
    >
      <TopTargetHandle />
      <BottomSourceHandle />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        <UiIcon name="plus" className="text-lg" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2" aria-hidden="true">
        <span className="h-2.5 w-36 rounded-full bg-gray-200" />
        <span className="h-2.5 w-24 rounded-full bg-gray-200" />
      </span>
    </div>
  );
}
