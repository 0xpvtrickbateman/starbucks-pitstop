import { expect, test, type Page } from "@playwright/test";

function mockGeolocationDenied() {
  return `
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success, error) {
          error({ message: 'Location permission blocked for test.' });
        },
      },
    });
  `;
}

function buildStore(overrides: Record<string, unknown> = {}) {
  return {
    id: "12345",
    name: "Starbucks Roosevelt",
    address: "123 Roosevelt Way NE",
    city: "Seattle",
    state: "WA",
    zip: "98105",
    latitude: 47.6616,
    longitude: -122.317,
    ownershipType: "CO",
    storeType: "cafe",
    features: ["Restroom likely", "Cafe"],
    distanceMiles: 0.4,
    codeSummary: {
      activeCodeCount: 1,
      hasCodes: true,
      hasConflict: false,
      topCode: {
        id: "code-1",
        codeDisplay: "4839",
        confidenceScore: 0.82,
      },
    },
    codes: [
      {
        id: "code-1",
        storeId: "12345",
        codeDisplay: "4839",
        isActive: true,
        deactivatedReason: null,
        upvotes: 4,
        downvotes: 1,
        confidenceScore: 0.82,
        createdAt: "2026-04-08T01:00:00.000Z",
        updatedAt: "2026-04-08T02:00:00.000Z",
      },
      {
        id: "code-old",
        storeId: "12345",
        codeDisplay: "1111",
        isActive: false,
        deactivatedReason: "superseded",
        upvotes: 1,
        downvotes: 6,
        confidenceScore: 0.08,
        createdAt: "2026-04-01T01:00:00.000Z",
        updatedAt: "2026-04-02T01:00:00.000Z",
      },
    ],
    inactiveCodeCount: 1,
    ...overrides,
  };
}

function getDetailPanel(page: Page, projectName: string, heading: string) {
  if (projectName === "mobile") {
    return page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: heading,
        }),
      })
      .last();
  }

  return page.getByRole("complementary");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(mockGeolocationDenied());

  await page.route("**/api/locations?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stores: [],
        meta: {
          source: "supabase",
          queryType: "bbox",
          count: 0,
        },
      }),
    });
  });
});

test("shows the denied geolocation fallback copy", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByText("Location permission blocked for test.").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Search by city, ZIP, address, or store name.").first(),
  ).toBeVisible();
});

test("search opens a store and supports old-code history", async ({ page }, testInfo) => {
  await page.route("**/api/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stores: [buildStore()],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Search a Starbucks location").fill("Roosevelt");
  await page.getByPlaceholder("Search a Starbucks location").press("Enter");

  const detailPanel = getDetailPanel(page, testInfo.project.name, "Starbucks Roosevelt");

  await expect(page.getByText("Starbucks Roosevelt").first()).toBeVisible();
  await expect(detailPanel.getByText("4839")).toBeVisible();

  await detailPanel.getByRole("button", { name: /Show old codes/i }).click();
  await expect(detailPanel.getByText("1111")).toBeVisible();
  await expect(detailPanel.getByText(/^OLD CODE$/)).toBeVisible();
});

test("submit and vote flows refresh the detail panel", async ({ page }, testInfo) => {
  await page.route("**/api/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stores: [
          buildStore({
            codeSummary: {
              activeCodeCount: 0,
              hasCodes: false,
              hasConflict: false,
              topCode: null,
            },
            codes: [],
            inactiveCodeCount: 0,
          }),
        ],
      }),
    });
  });

  await page.route("**/api/codes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        existing: false,
        codes: [
          {
            id: "code-new",
            storeId: "12345",
            codeDisplay: "4839",
            isActive: true,
            deactivatedReason: null,
            upvotes: 0,
            downvotes: 0,
            confidenceScore: 0,
            createdAt: "2026-04-08T03:00:00.000Z",
            updatedAt: "2026-04-08T03:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/votes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        codes: [
          {
            id: "code-new",
            storeId: "12345",
            codeDisplay: "4839",
            isActive: true,
            deactivatedReason: null,
            upvotes: 1,
            downvotes: 0,
            confidenceScore: 0.21,
            createdAt: "2026-04-08T03:00:00.000Z",
            updatedAt: "2026-04-08T03:04:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Search a Starbucks location").fill("Roosevelt");
  await page.getByPlaceholder("Search a Starbucks location").press("Enter");

  const detailPanel = getDetailPanel(page, testInfo.project.name, "Starbucks Roosevelt");

  await detailPanel.getByLabel("Code").fill("4839");
  await detailPanel.getByRole("button", { name: "Submit code" }).click();

  await expect(
    detailPanel.getByText("Code saved. Thanks for helping the next person."),
  ).toBeVisible();
  await expect(detailPanel.getByText("4839")).toBeVisible();

  await detailPanel.getByRole("button", { name: "Vote code up" }).click();
  await expect(detailPanel.getByText("Marked as still working.")).toBeVisible();
  await expect(detailPanel.getByText("1 upvotes")).toBeVisible();
});
