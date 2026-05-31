import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import {
  planMissionWithVenice,
  synthesizeFinalReportWithVenice,
  verifyAgentOutputWithVenice
} from "../lib/adapters/ai/venice";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const DEFAULT_VENICE_BASE_URL = "https://api.venice.ai/api/v1";
const DEFAULT_VENICE_MODEL = "zai-org-glm-5-1";

type ProviderCategory =
  | "configuration"
  | "auth"
  | "credits_billing"
  | "rate_limit"
  | "model"
  | "request_format"
  | "structured_output"
  | "network"
  | "provider"
  | "unknown";

interface SafeEndpointDiagnostic {
  statusCode?: number;
  ok: boolean;
  authAppearsValid: boolean;
  providerCategory: ProviderCategory;
}

interface ModelCheck {
  endpoint: SafeEndpointDiagnostic;
  modelCount: number;
  availableModelIdsSample: string[];
  defaultModel?: string;
  fastestModel?: string;
  selectedModelExists: boolean;
  selectedModelIsDefault: boolean;
}

interface BalanceCheck {
  endpoint: SafeEndpointDiagnostic;
  canConsume?: boolean;
  consumptionCurrency?: string;
  hasPositiveUsdBalance?: boolean;
  hasPositiveDiemBalance?: boolean;
}

const smokeMission: Mission = {
  id: "venice-smoke-mission",
  title: "Wallet / Token Risk Report",
  targetAddress: "0x0000000000000000000000000000000000000402",
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "venice-smoke-mission",
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
  taskId: "venice-smoke-mission:contract-scanner",
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
  const env = {
    ...process.env,
    ...readEnvLocal()
  };

  if (!env.VENICE_API_KEY) {
    delete env.VENICE_API_KEY;
  }

  if (!env.VENICE_BASE_URL) {
    delete env.VENICE_BASE_URL;
  }

  if (!env.VENICE_MODEL) {
    delete env.VENICE_MODEL;
  }

  return env;
}

function fieldRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function stringField(value: unknown, key: string): string | undefined {
  const field = fieldRecord(value)?.[key];

  return typeof field === "string" ? field : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
  const field = fieldRecord(value)?.[key];

  return typeof field === "number" ? field : undefined;
}

function booleanField(value: unknown, key: string): boolean | undefined {
  const field = fieldRecord(value)?.[key];

  return typeof field === "boolean" ? field : undefined;
}

function arrayField(value: unknown, key: string): unknown[] {
  const field = fieldRecord(value)?.[key];

  return Array.isArray(field) ? field : [];
}

function safeHost(value: string | undefined): string {
  try {
    return new URL(value ?? DEFAULT_VENICE_BASE_URL).host;
  } catch {
    return "invalid-url";
  }
}

function categoryFromStatus(statusCode: number | undefined): ProviderCategory {
  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }

  if (statusCode === 402) {
    return "credits_billing";
  }

  if (statusCode === 429) {
    return "rate_limit";
  }

  if (statusCode === 400 || statusCode === 415) {
    return "request_format";
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return "provider";
  }

  if (typeof statusCode === "number" && statusCode >= 200 && statusCode < 300) {
    return "unknown";
  }

  return "network";
}

async function safeGetJson(
  baseURL: string,
  path: string,
  apiKey: string | undefined
): Promise<{ diagnostic: SafeEndpointDiagnostic; json?: unknown }> {
  if (!apiKey) {
    return {
      diagnostic: {
        ok: false,
        authAppearsValid: false,
        providerCategory: "configuration"
      }
    };
  }

  try {
    const response = await fetch(new URL(path, baseURL.endsWith("/") ? baseURL : `${baseURL}/`), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    });

    let json: unknown;

    try {
      json = await response.json();
    } catch {
      json = undefined;
    }

    return {
      diagnostic: {
        statusCode: response.status,
        ok: response.ok,
        authAppearsValid: response.status !== 401 && response.status !== 403,
        providerCategory: categoryFromStatus(response.status)
      },
      json
    };
  } catch {
    return {
      diagnostic: {
        ok: false,
        authAppearsValid: false,
        providerCategory: "network"
      }
    };
  }
}

async function checkModels(env: Record<string, string | undefined>, selectedModel: string): Promise<ModelCheck> {
  const baseURL = env.VENICE_BASE_URL ?? DEFAULT_VENICE_BASE_URL;
  const models = await safeGetJson(baseURL, "models?type=text", env.VENICE_API_KEY);
  const traits = await safeGetJson(baseURL, "models/traits?type=text", env.VENICE_API_KEY);
  const modelRecords = arrayField(models.json, "data")
    .map(fieldRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const modelIds = modelRecords.map((record) => stringField(record, "id")).filter((id): id is string => Boolean(id));
  const traitData = fieldRecord(fieldRecord(traits.json)?.data);
  const defaultModel = stringField(traitData, "default");
  const fastestModel = stringField(traitData, "fastest");

  return {
    endpoint: {
      statusCode: models.diagnostic.statusCode,
      ok: models.diagnostic.ok && traits.diagnostic.ok,
      authAppearsValid: models.diagnostic.authAppearsValid && traits.diagnostic.authAppearsValid,
      providerCategory: models.diagnostic.ok ? traits.diagnostic.providerCategory : models.diagnostic.providerCategory
    },
    modelCount: modelIds.length,
    availableModelIdsSample: modelIds.slice(0, 12),
    defaultModel,
    fastestModel,
    selectedModelExists: modelIds.includes(selectedModel) || selectedModel === defaultModel || selectedModel === fastestModel,
    selectedModelIsDefault: selectedModel === defaultModel
  };
}

async function checkBalance(env: Record<string, string | undefined>): Promise<BalanceCheck> {
  const baseURL = env.VENICE_BASE_URL ?? DEFAULT_VENICE_BASE_URL;
  const response = await safeGetJson(baseURL, "billing/balance", env.VENICE_API_KEY);
  const balances = fieldRecord(fieldRecord(response.json)?.balances);
  const usdBalance = numberField(balances, "usd");
  const diemBalance = numberField(balances, "diem");

  return {
    endpoint: response.diagnostic,
    canConsume: booleanField(response.json, "canConsume"),
    consumptionCurrency: stringField(response.json, "consumptionCurrency"),
    hasPositiveUsdBalance: typeof usdBalance === "number" ? usdBalance > 0 : undefined,
    hasPositiveDiemBalance: typeof diemBalance === "number" ? diemBalance > 0 : undefined
  };
}

function failureClass(notes: string[]): ProviderCategory | undefined {
  const joined = notes.join(" ").toLowerCase();

  if (!joined) {
    return undefined;
  }

  if (joined.includes("401") || joined.includes("403") || joined.includes("auth") || joined.includes("api key")) {
    return "auth";
  }

  if (joined.includes("402") || joined.includes("credit") || joined.includes("balance") || joined.includes("quota")) {
    return "credits_billing";
  }

  if (joined.includes("429") || joined.includes("rate")) {
    return "rate_limit";
  }

  if (joined.includes("model")) {
    return "model";
  }

  if (joined.includes("json") || joined.includes("schema")) {
    return "structured_output";
  }

  if (joined.includes("fetch") || joined.includes("network") || joined.includes("timeout")) {
    return "network";
  }

  return "provider";
}

function adapterDiagnostic(result: {
  diagnostic?: { statusCode?: number; errorClass: string; providerCategory: string; providerCode?: string };
}) {
  return result.diagnostic
    ? {
        statusCode: result.diagnostic.statusCode,
        errorClass: result.diagnostic.errorClass,
        providerCategory: result.diagnostic.providerCategory,
        providerCode: result.diagnostic.providerCode
      }
    : undefined;
}

describe("server-only Venice smoke test", () => {
  it("calls the existing Venice adapter and prints only redacted status fields", async () => {
    const env = smokeEnv();
    const hasApiKey = Boolean(env.VENICE_API_KEY);
    const model = env.VENICE_MODEL ?? DEFAULT_VENICE_MODEL;
    const baseURLHost = safeHost(env.VENICE_BASE_URL);
    const modelCheck = await checkModels(env, model);
    const balanceCheck = await checkBalance(env);

    const plan = await planMissionWithVenice(smokeMission, { env });
    const verification = await verifyAgentOutputWithVenice(smokeOutput, { env });
    const report = await synthesizeFinalReportWithVenice([smokeOutput], { env });
    const creditsBlocker =
      balanceCheck.endpoint.ok &&
      balanceCheck.canConsume === false &&
      plan.diagnostic?.providerCategory === "credits_billing" &&
      verification.diagnostic?.providerCategory === "credits_billing" &&
      report.diagnostic?.providerCategory === "credits_billing";

    console.info(
      "[venice-smoke]",
      JSON.stringify(
        {
          env: {
            envLocalFound: existsSync(ENV_LOCAL_PATH),
            veniceApiKeyConfigured: hasApiKey,
            baseURLHost,
            model
          },
          modelCheck,
          balanceCheck,
          plan: {
            mode: plan.mode,
            state: plan.state,
            model: plan.model,
            taskCount: plan.tasks.length,
            noteCount: plan.notes.length,
            failureClass: plan.diagnostic?.providerCategory ?? failureClass(plan.notes),
            diagnostic: adapterDiagnostic(plan)
          },
          verification: {
            mode: verification.mode,
            state: verification.state,
            model: verification.model,
            verified: verification.verified,
            confidence: verification.confidence,
            noteCount: verification.notes.length,
            failureClass: verification.diagnostic?.providerCategory ?? failureClass(verification.notes),
            diagnostic: adapterDiagnostic(verification),
            riskSignalCount: verification.riskSignals.length,
            requiresHumanReview: verification.requiresHumanReview
          },
          report: {
            mode: report.mode,
            state: report.state,
            model: report.model,
            status: report.report.status,
            riskLevel: report.report.riskLevel,
            sectionCount: report.report.sections.length,
            recommendationCount: report.report.recommendations.length,
            noteCount: report.notes.length,
            failureClass: report.diagnostic?.providerCategory ?? failureClass(report.notes),
            diagnostic: adapterDiagnostic(report)
          },
          diagnosis: {
            authWorks: modelCheck.endpoint.authAppearsValid && balanceCheck.endpoint.authAppearsValid,
            selectedModelExists: modelCheck.selectedModelExists,
            canConsume: balanceCheck.canConsume,
            creditsBlocker
          }
        },
        null,
        2
      )
    );

    if (!hasApiKey) {
      expect(plan.state).toBe("skipped_missing_api_key");
      expect(verification.state).toBe("skipped_missing_api_key");
      expect(report.state).toBe("skipped_missing_api_key");
      return;
    }

    expect(modelCheck.endpoint.authAppearsValid).toBe(true);
    expect(modelCheck.selectedModelExists).toBe(true);

    if (creditsBlocker) {
      expect(balanceCheck.canConsume).toBe(false);
      return;
    }

    expect(plan).toMatchObject({ mode: "live", state: "completed" });
    expect(verification).toMatchObject({ mode: "live", state: "completed" });
    expect(report).toMatchObject({ mode: "live", state: "completed" });
  });
});
