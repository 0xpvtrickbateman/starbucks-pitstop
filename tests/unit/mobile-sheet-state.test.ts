import { describe, expect, it } from "vitest";
import {
  MOBILE_SHEET_DRAG_THRESHOLD,
  getMobileSheetPositionClass,
  resolveDraggedSheetState,
  type MobileSheetState,
} from "@/components/layout/MobileSheet";

describe("mobile sheet state mapping", () => {
  it.each([
    ["open", "translate-y-0"],
    ["peek", "translate-y-[calc(100%-7.75rem)]"],
    ["collapsed", "translate-y-[calc(100%-4.25rem)]"],
  ] satisfies Array<[MobileSheetState, string]>)(
    "maps %s to the expected transform class",
    (state, expectedClass) => {
      expect(getMobileSheetPositionClass(state)).toBe(expectedClass);
    },
  );

  it("keeps peek distinct from fully open and collapsed", () => {
    expect(getMobileSheetPositionClass("peek")).not.toBe(
      getMobileSheetPositionClass("open"),
    );
    expect(getMobileSheetPositionClass("peek")).not.toBe(
      getMobileSheetPositionClass("collapsed"),
    );
  });

  it("opens, peeks, and collapses based on drag thresholds", () => {
    expect(
      resolveDraggedSheetState("peek", -(MOBILE_SHEET_DRAG_THRESHOLD + 1)),
    ).toBe("open");
    expect(
      resolveDraggedSheetState("open", MOBILE_SHEET_DRAG_THRESHOLD + 1),
    ).toBe("peek");
    expect(
      resolveDraggedSheetState("peek", MOBILE_SHEET_DRAG_THRESHOLD + 1),
    ).toBe("collapsed");
    expect(
      resolveDraggedSheetState("collapsed", -(MOBILE_SHEET_DRAG_THRESHOLD + 1)),
    ).toBe("peek");
  });

  it("ignores tiny drags", () => {
    expect(resolveDraggedSheetState("peek", 12)).toBe("peek");
    expect(resolveDraggedSheetState("open", -12)).toBe("open");
  });
});
