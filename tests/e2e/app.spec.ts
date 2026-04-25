import { expect, test, type Page } from "@playwright/test";

function mockGeolocationDenied() {
  return `
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success, error) {
          window.__geoCalls += 1;
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

function buildSeattleStores() {
  return [
    buildStore({
      id: "17844",
      name: "35th & Fauntleroy",
      address: "4408 Fauntleroy Way SW",
      zip: "98126",
      latitude: 47.5386,
      longitude: -122.3878,
      codeSummary: {
        activeCodeCount: 0,
        hasCodes: false,
        hasConflict: false,
        topCode: null,
      },
      codes: [],
      inactiveCodeCount: 0,
    }),
    buildStore({
      id: "11917",
      name: "3rd & Madison",
      address: "999 3rd Ave",
      zip: "98104",
      latitude: 47.6052,
      longitude: -122.3339,
      codeSummary: {
        activeCodeCount: 1,
        hasCodes: true,
        hasConflict: false,
        topCode: {
          id: "code-2",
          codeDisplay: "2468",
          confidenceScore: 0.73,
        },
      },
      codes: [
        {
          id: "code-2",
          storeId: "11917",
          codeDisplay: "2468",
          isActive: true,
          deactivatedReason: null,
          upvotes: 3,
          downvotes: 0,
          confidenceScore: 0.73,
          createdAt: "2026-04-08T03:00:00.000Z",
          updatedAt: "2026-04-08T03:00:00.000Z",
        },
      ],
      inactiveCodeCount: 0,
    }),
  ];
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

test("does not request geolocation until a user action", async ({ page }, testInfo) => {
  await page.goto("/");

  expect(
    await page.evaluate(
      () => (window as unknown as Window & { __geoCalls: number }).__geoCalls,
    ),
  ).toBe(0);

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Expand details" }).click();
  }

  const locationButton = page
    .getByRole("button", { name: /Use my location|Near me/i })
    .first();
  await locationButton.dispatchEvent("click");

  await expect(
    page.getByText("Location permission blocked for test.").first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as Window & { __geoCalls: number }).__geoCalls,
    ),
  ).toBe(1);
});

test("ambiguous search shows a selectable result list", async ({ page }, testInfo) => {
  await page.route("**/api/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stores: buildSeattleStores(),
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Search a Starbucks location").fill("Seattle");
  await page.getByPlaceholder("Search a Starbucks location").press("Enter");

  await expect(page.getByText("PICK A LOCATION")).toBeVisible();
  await expect(page.getByRole("button", { name: /35th & Fauntleroy/i })).toBeVisible();
  await page.getByRole("button", { name: /3rd & Madison/i }).click();

  const detailPanel = getDetailPanel(page, testInfo.project.name, "3rd & Madison");
  await expect(detailPanel.getByText("2468")).toBeVisible();
});

test("exact search still jumps directly to one store", async ({ page }, testInfo) => {
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

  await expect(page.getByText("PICK A LOCATION")).toHaveCount(0);
  const detailPanel = getDetailPanel(page, testInfo.project.name, "Starbucks Roosevelt");
  await expect(detailPanel.getByText("4839")).toBeVisible();
});

test("submit and vote flows still refresh the detail panel", async ({ page }, testInfo) => {
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
  await detailPanel.getByRole("button", { name: "Submit entry" }).click();

  await expect(
    detailPanel.getByText("Code saved. Thanks for helping the next person."),
  ).toBeVisible();
  await expect(detailPanel.getByText("4839")).toBeVisible();

  await detailPanel.getByRole("button", { name: "Vote code up" }).click();
  await expect(detailPanel.getByText("Marked as still working.")).toBeVisible();
  await expect(detailPanel.getByText("1 upvotes")).toBeVisible();
});

test("supports submitting a no-code-required entry", async ({ page }, testInfo) => {
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
            id: "code-no-code",
            storeId: "12345",
            codeDisplay: "No Code Required",
            isActive: true,
            deactivatedReason: null,
            upvotes: 0,
            downvotes: 0,
            confidenceScore: 0,
            createdAt: "2026-04-13T03:00:00.000Z",
            updatedAt: "2026-04-13T03:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Search a Starbucks location").fill("Roosevelt");
  await page.getByPlaceholder("Search a Starbucks location").press("Enter");

  const detailPanel = getDetailPanel(page, testInfo.project.name, "Starbucks Roosevelt");

  await detailPanel.locator('input[value="no-code-required"]').check({ force: true });
  await detailPanel.getByRole("button", { name: "Submit entry" }).click();

  await expect(
    detailPanel.getByText("No-code report saved. Thanks for helping the next person."),
  ).toBeVisible();
  await expect(detailPanel.getByText("No Code Required")).toBeVisible();
});

test("mobile keeps a single location CTA and a compact peek state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Use my location" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Near me$/ })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Find a Starbucks", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("shows a graceful map recovery message on blocked local origins", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByText(/Basemap blocked on this local origin|MAP TOKEN REQUIRED/i).first(),
  ).toBeVisible();
});
