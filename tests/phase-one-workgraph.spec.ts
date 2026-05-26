import { expect, test } from "playwright/test";

test.describe("Phase 1 WorkGraph smoke tests", () => {
  test("landing page loads with WorkGraph visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Mission Budget WorkGraph/i })).toBeVisible();
    await expect(page.getByTestId("workgraph-canvas")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-mission-budget")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-manager-agent")).toBeVisible();
  });

  test("create mission page loads", async ({ page }) => {
    await page.goto("/missions/new");

    await expect(page.getByTestId("create-mission-page")).toBeVisible();
    await expect(page.getByTestId("create-mission-form")).toBeVisible();
    await expect(page.locator('input[value="Wallet / Token Risk Report"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Mock Mission/i })).toBeVisible();
  });

  test("mission detail page exposes core audit graph nodes", async ({ page }) => {
    await page.goto("/missions/risk-report-demo");

    await expect(page.getByTestId("mission-detail-page")).toBeVisible();
    await expect(page.getByTestId("workgraph-shell")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-mission-budget")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-manager-agent")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-contract-scanner")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-x402-payment")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-final-report")).toBeVisible();
  });

  test("blocked payment branch is visible", async ({ page }) => {
    await page.goto("/missions/risk-report-demo");

    await expect(page.getByTestId("workgraph-node-blocked-payment")).toBeVisible();
    await expect(page.getByText("Policy blocked spend")).toBeVisible();
    await expect(page.getByTestId("event-log")).toContainText("Overspend blocked");
  });

  test("mobile viewport keeps critical content accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/missions/risk-report-demo");

    await expect(page.getByTestId("mission-detail-page")).toBeVisible();
    await expect(page.getByTestId("workgraph-canvas")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-mission-budget")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-blocked-payment")).toBeVisible();
    await expect(page.getByTestId("workgraph-node-details")).toBeVisible();
  });
});
