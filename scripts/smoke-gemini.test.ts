import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import { planMission, synthesizeFinalReport, verifyAgentOutput } from "../lib/adapters/ai/provider";
import type { AiFailureDiagnostic } from "../lib/adapters/ai/provider-types";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const smokeMission: Mission = {
  id: "gemini-smoke-mission",
  title: "Wallet / Token Risk Report",
  targetAddress: "0x0000000000000000000000000000000000000402",
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "gemini-smoke-mission",
    totalBudget: {
      amount: "3.00",
      currency: "USDC",
      chainId: 84532
    },
    maxPerAgent: {
      amount: "0.50",
      currency: "USDC",
      chainId: 84532
    },
    expiresAt: "2026-05-31T01:00:00.000Z",
    allowedPaymentProtocol: "x402"
  }
};

const smokeOutput: AgentOutput = {
  taskId: "gemini-smoke-mission:contract-scanner",
  summary: "Smoke output flags upgrade authority and incomplete verified-source confidence.",
  evidence: ["Upgrade authority marker present", "Verified-source confidence unresolved"],
  riskSignals: ["upgradeable-contract", "verification-needed"]
};

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readEnvLocal(): Record<string, string | undefined> {
  if (!existsSync(ENV_LOCAL_PATH)) {
    return {};
  }

  return readFileSync(ENV_LOCAL_PATH, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string | undefined>>((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex <= 0) {
        return env;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = stripQuotes(trimmed.slice(equalsIndex + 1));

      env[key] = value || undefined;
      return env;
    }, {});
}

function smokeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...readEnvLocal(),
    AI_PROVIDER: "gemini"
  };

  if (!env.GEMINI_API_KEY) {
    delete env.GEMINI_API_KEY;
  }

  if (!env.GEMINI_MODEL) {
    delete env.GEMINI_MODEL;
  }

  return env;
}

function diagnostic(value: { diagnostic?: AiFailureDiagnostic }) {
  return value.diagnostic
    ? {
        statusCode: value.diagnostic.statusCode,
        errorClass: value.diagnostic.errorClass,
        providerCategory: value.diagnostic.providerCategory,
        providerCode: value.diagnostic.providerCode
      }
    : undefined;
}

function isCompleted(value: { mode: string; state: string }): boolean {
  return (value.mode === "live" || value.mode === "dev") && value.state === "completed";
}

function isDiagnosedProviderFallback(value: { diagnostic?: AiFailureDiagnostic; mode: string; state: string }): boolean {
  return (
    value.mode === "fallback" &&
    value.state === "request_failed" &&
    (value.diagnostic?.providerCategory === "provider" ||
      value.diagnostic?.providerCategory === "rate_limit" ||
      value.diagnostic?.providerCategory === "network" ||
      value.diagnostic?.providerCategory === "structured_output")
  );
}

function isCompletedOrDiagnosedProviderResult(value: {
  diagnostic?: AiFailureDiagnostic;
  mode: string;
  state: string;
}): boolean {
  return isCompleted(value) || isDiagnosedProviderFallback(value);
}

describe("server-only Gemini smoke test", () => {
  it("calls the Gemini dev provider and prints only redacted status fields", async () => {
    const env = smokeEnv();
    const authConfigured = Boolean(env.GEMINI_API_KEY);
    const model = env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

    const plan = await planMission(smokeMission, { env });
    const verification = await verifyAgentOutput(smokeOutput, { env });
    const report = await synthesizeFinalReport([smokeOutput], { env });

    console.info(
      "[gemini-smoke]",
      JSON.stringify(
        {
          provider: plan.provider,
          providerRole: plan.providerRole,
          env: {
            envLocalFound: existsSync(ENV_LOCAL_PATH),
            authConfigured,
            model
          },
          plan: {
            state: plan.state,
            mode: plan.mode,
            model: plan.model,
            taskCount: plan.tasks.length,
            failureCategory: plan.diagnostic?.providerCategory,
            diagnostic: diagnostic(plan)
          },
          verification: {
            state: verification.state,
            mode: verification.mode,
            model: verification.model,
            verified: verification.verified,
            confidence: verification.confidence,
            failureCategory: verification.diagnostic?.providerCategory,
            diagnostic: diagnostic(verification)
          },
          report: {
            state: report.state,
            mode: report.mode,
            model: report.model,
            status: report.report.status,
            sectionCount: report.report.sections.length,
            recommendationCount: report.report.recommendations.length,
            failureCategory: report.diagnostic?.providerCategory,
            diagnostic: diagnostic(report)
          }
        },
        null,
        2
      )
    );

    expect(plan.provider).toBe("gemini");
    expect(verification.provider).toBe("gemini");
    expect(report.provider).toBe("gemini");

    if (!authConfigured) {
      expect(plan.state).toBe("skipped_missing_api_key");
      expect(verification.state).toBe("skipped_missing_api_key");
      expect(report.state).toBe("skipped_missing_api_key");
      return;
    }

    const allCompleted = isCompleted(plan) && isCompleted(verification) && isCompleted(report);

    if (!allCompleted) {
      expect(isCompletedOrDiagnosedProviderResult(plan)).toBe(true);
      expect(isCompletedOrDiagnosedProviderResult(verification)).toBe(true);
      expect(isCompletedOrDiagnosedProviderResult(report)).toBe(true);
      return;
    }

    expect(allCompleted).toBe(true);
  }, 60_000);
});
