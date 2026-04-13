import { describe, expect, it } from "vitest";
import { getMapboxRecoveryIssueForOrigin } from "@/lib/mapbox-origin";

describe("getMapboxRecoveryIssueForOrigin", () => {
  it("flags local ports other than 3000", () => {
    expect(
      getMapboxRecoveryIssueForOrigin("http://localhost:3001"),
    ).toMatchObject({
      title: "Basemap blocked on this local origin",
    });
    expect(
      getMapboxRecoveryIssueForOrigin("http://127.0.0.1:3002"),
    ).toMatchObject({
      title: "Basemap blocked on this local origin",
    });
  });

  it("allows the explicitly supported local origin", () => {
    expect(getMapboxRecoveryIssueForOrigin("http://localhost:3000")).toBeNull();
  });
});
