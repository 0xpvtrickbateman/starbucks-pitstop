import { describe, expect, it } from "vitest";
import {
  getMobileSheetPositionClass,
  type MobileSheetState,
} from "@/components/layout/MobileSheet";

describe("mobile sheet state mapping", () => {
  it.each([
    ["open", "translate-y-0"],
    ["peek", "translate-y-[calc(100%-14rem)] sm:translate-y-[calc(100%-16rem)]"],
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
});
