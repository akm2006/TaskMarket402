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
    await expect(page.getByTestId("ai-runtime-panel")).toBeVisible();
    await expect(page.getByTestId("ai-runtime-empty")).toContainText("Static mock snapshot");
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

  test("AI runtime panel displays client-safe provider state", async ({ page }) => {
    await page.route("**/api/missions/risk-report-demo/ai-run", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          source: "ai_runtime",
          staticBaseline: "phase_one_mock_snapshot",
          specialistOutputSource: "real_data_agents",
          paymentFlow: "x402_style_dev",
          paymentEvents: [
            {
              id: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner:payment_required",
              type: "payment_required",
              agentKind: "contract_scanner",
              taskId: "risk-report-demo:contract-scanner",
              resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
              title: "Payment required",
              detail: "x402-style development challenge created before specialist output is returned.",
              amount: "0.40",
              currency: "USDC",
              occurredAt: "2026-05-31T12:00:00.000Z",
              simulatedSettlement: true
            },
            {
              id: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner:dev_payment_accepted",
              type: "dev_payment_accepted",
              agentKind: "contract_scanner",
              taskId: "risk-report-demo:contract-scanner",
              resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
              title: "Development payment accepted",
              detail: "Development-only proof accepted; no real x402 settlement occurred.",
              amount: "0.40",
              currency: "USDC",
              occurredAt: "2026-05-31T12:00:00.000Z",
              simulatedSettlement: true
            },
            {
              id: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner:agent_output_returned",
              type: "agent_output_returned",
              agentKind: "contract_scanner",
              taskId: "risk-report-demo:contract-scanner",
              resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
              title: "Agent output returned",
              detail: "contract scanner returned a real-data output after simulated payment acceptance.",
              amount: "0.40",
              currency: "USDC",
              occurredAt: "2026-05-31T12:00:00.000Z",
              simulatedSettlement: true
            }
          ],
          missionId: "risk-report-demo",
          generatedAt: "2026-05-31T12:00:00.000Z",
          provider: "gemini",
          providerRole: "development_testing",
          mode: "dev",
          state: "completed",
          specialistOutputs: [
            {
              taskId: "risk-report-demo:contract-scanner",
              agentKind: "contract_scanner",
              source: "real-data",
              summary: "Mocked Base RPC contract output.",
              evidence: ["Output source: real-data"],
              riskSignals: ["contract-bytecode-present"],
              diagnostics: []
            },
            {
              taskId: "risk-report-demo:wallet-behavior",
              agentKind: "wallet_behavior",
              source: "fallback",
              summary: "Mocked wallet behavior fallback.",
              evidence: ["Output source: fallback"],
              riskSignals: ["explorer-missing_api_key"],
              diagnostics: ["Explorer fallback: missing_api_key"]
            },
            {
              taskId: "risk-report-demo:market-context",
              agentKind: "market_context",
              source: "mock",
              summary: "Mocked market context output.",
              evidence: ["Output source: mock"],
              riskSignals: ["mock-market-context"],
              diagnostics: []
            }
          ],
          plan: {
            status: {
              provider: "gemini",
              providerRole: "development_testing",
              mode: "dev",
              state: "completed",
              model: "mocked-gemini"
            },
            rationale: "Mocked AI runtime created a bounded plan.",
            taskCount: 1,
            tasks: [
              {
                id: "risk-report-demo:contract-scanner",
                missionId: "risk-report-demo",
                agentKind: "contract_scanner",
                objective: "Scan contract risk indicators.",
                budget: {
                  amount: "0.40",
                  currency: "USDC",
                  chainId: 84532
                }
              }
            ]
          },
          verification: {
            status: {
              provider: "gemini",
              providerRole: "development_testing",
              mode: "dev",
              state: "completed",
              model: "mocked-gemini"
            },
            verifiedCount: 1,
            requiresHumanReviewCount: 0,
            items: [
              {
                taskId: "risk-report-demo:contract-scanner",
                status: {
                  provider: "gemini",
                  providerRole: "development_testing",
                  mode: "dev",
                  state: "completed",
                  model: "mocked-gemini"
                },
                verified: true,
                confidence: "medium",
                riskSignals: ["owner-privilege"],
                requiresHumanReview: false,
                notes: ["Verified mocked output."]
              }
            ]
          },
          finalReport: {
            status: {
              provider: "gemini",
              providerRole: "development_testing",
              mode: "dev",
              state: "completed",
              model: "mocked-gemini"
            },
            report: {
              title: "Wallet / Token Risk Report",
              status: "synthesized",
              summary: "Mocked AI report summary.",
              riskLevel: "medium",
              sections: [{ heading: "Summary", body: "Mocked report section." }],
              recommendations: ["Keep policy in core."],
              verificationSummary: "Verified through mocked runtime."
            }
          }
        })
      });
    });

    await page.goto("/missions/risk-report-demo");
    await page.getByTestId("run-ai-analysis").click();

    await expect(page.getByTestId("ai-runtime-result")).toBeVisible();
    await expect(page.getByTestId("paid-agent-flow")).toContainText("Specialist paid-agent flow");
    await expect(page.getByTestId("paid-agent-flow")).toContainText("simulated");
    await expect(page.getByTestId("specialist-data-outputs")).toContainText("real-data");
    await expect(page.getByTestId("specialist-data-outputs")).toContainText("fallback");
    await expect(page.getByTestId("ai-runtime-panel")).toContainText("AI-generated plan");
    await expect(page.getByTestId("ai-runtime-status").first()).toContainText("Gemini / dev");
    await expect(page.getByTestId("ai-runtime-panel")).toContainText("Completed");
    await expect(page.getByTestId("ai-runtime-panel")).toContainText("Mocked AI report summary.");
  });
});
