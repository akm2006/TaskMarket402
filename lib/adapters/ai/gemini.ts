import { createInitialAgentPlan } from "../../core/agent-orchestrator";
import { validateTaskBudgets } from "../../core/policy";
import type { AgentKind, AgentOutput, AgentTask, Mission } from "../../core/types";
import {
  aiAgentOutputVerificationJsonSchema,
  aiAgentOutputVerificationSchema,
  aiFinalReportSynthesisJsonSchema,
  aiFinalReportSynthesisSchema,
  aiMissionPlanJsonSchema,
  aiMissionPlanSchema,
  type AiMissionPlanPayload
} from "./schemas";
import type {
  AiFailureDiagnostic,
  AiFinalReportResult,
  AiPlanResult,
  AiProviderCategory,
  AiProviderClient,
  AiProviderOptions,
  AiVerificationResult
} from "./provider-types";
import {
  buildAgentOutputVerificationPromptPayload,
  buildFinalReportSynthesisPromptPayload,
  buildMissionPlanPromptPayload,
  stringifyAiPromptPayload
} from "./prompts";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type GeminiFallbackState = "skipped_missing_api_key" | "empty_response" | "invalid_response" | "request_failed" | "policy_rejected";

interface GeminiConfig {
  apiKey?: string;
  model: string;
}

interface GeminiGenerateRequest {
  model: string;
  prompt: string;
  responseSchema: unknown;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export interface GeminiGenerateClient {
  generateContent(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse>;
}

interface GeminiAdapterOptions extends AiProviderOptions {
  client?: GeminiGenerateClient;
  model?: string;
}

interface GeminiJsonSuccess<T> {
  ok: true;
  data: T;
  model: string;
}

interface GeminiJsonFailure {
  ok: false;
  state: GeminiFallbackState;
  model: string;
  notes: string[];
  diagnostic: AiFailureDiagnostic;
}

class GeminiHttpError extends Error {
  statusCode: number;
  providerCode?: string;

  constructor(statusCode: number, providerCode?: string) {
    super("Gemini request failed.");
    this.name = "GeminiHttpError";
    this.statusCode = statusCode;
    this.providerCode = providerCode;
  }
}

function resolveConfig(options: GeminiAdapterOptions): GeminiConfig {
  const env = options.env ?? process.env;

  return {
    apiKey: env.GEMINI_API_KEY,
    model: options.model ?? env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  };
}

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readStringField(value: unknown, key: string): string | undefined {
  const record = recordFromUnknown(value);
  const field = record?.[key];

  return typeof field === "string" ? field : undefined;
}

function readNestedStringField(value: unknown, outerKey: string, key: string): string | undefined {
  return readStringField(recordFromUnknown(value)?.[outerKey], key);
}

function providerCategory(statusCode: number | undefined, providerCode: string | undefined): AiProviderCategory {
  const normalizedCode = providerCode?.toLowerCase() ?? "";

  if (statusCode === 401 || statusCode === 403 || normalizedCode.includes("api_key") || normalizedCode.includes("auth")) {
    return "auth";
  }

  if (statusCode === 402 || normalizedCode.includes("billing") || normalizedCode.includes("quota")) {
    return "credits_billing";
  }

  if (statusCode === 429 || normalizedCode.includes("rate")) {
    return "rate_limit";
  }

  if (statusCode === 404 || normalizedCode.includes("model")) {
    return "model";
  }

  if (statusCode === 400 || statusCode === 415 || normalizedCode.includes("invalid")) {
    return "request_format";
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return "provider";
  }

  return "unknown";
}

function diagnosticFromError(error: unknown): AiFailureDiagnostic {
  if (error instanceof GeminiHttpError) {
    return {
      statusCode: error.statusCode,
      errorClass: error.name,
      providerCategory: providerCategory(error.statusCode, error.providerCode),
      providerCode: error.providerCode
    };
  }

  if (error instanceof Error) {
    return {
      errorClass: error.constructor.name,
      providerCategory: error.message.toLowerCase().includes("fetch") ? "network" : "unknown"
    };
  }

  return {
    errorClass: "UnknownError",
    providerCategory: "unknown"
  };
}

function canRetry(diagnostic: AiFailureDiagnostic): boolean {
  return (
    diagnostic.providerCategory === "provider" ||
    diagnostic.providerCategory === "network" ||
    diagnostic.providerCategory === "rate_limit"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRestGeminiClient(config: GeminiConfig): GeminiGenerateClient {
  return {
    async generateContent(request) {
      const url = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(request.model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey ?? ""
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: request.prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1400,
            responseMimeType: "application/json",
            responseSchema: request.responseSchema
          }
        })
      });

      if (!response.ok) {
        let json: unknown;

        try {
          json = await response.json();
        } catch {
          json = undefined;
        }

        throw new GeminiHttpError(response.status, readStringField(json, "error") ?? readNestedStringField(json, "error", "status"));
      }

      return (await response.json()) as GeminiGenerateResponse;
    }
  };
}

function schemaIssueNotes(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string[] {
  return error.issues.slice(0, 3).map((issue) => `Invalid Gemini response: ${issue.path.join(".") || "root"} ${issue.message}`);
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const objectStart = unfenced.indexOf("{");

    if (objectStart >= 0) {
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let index = objectStart; index < unfenced.length; index += 1) {
        const char = unfenced[index];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) {
          continue;
        }

        if (char === "{") {
          depth += 1;
        }

        if (char === "}") {
          depth -= 1;

          if (depth === 0) {
            return JSON.parse(unfenced.slice(objectStart, index + 1));
          }
        }
      }
    }

    throw new Error("Gemini content was not valid JSON.");
  }
}

async function requestGeminiJson<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } },
  prompt: string,
  responseSchema: unknown,
  options: GeminiAdapterOptions
): Promise<GeminiJsonSuccess<T> | GeminiJsonFailure> {
  const config = resolveConfig(options);

  if (!config.apiKey) {
    return {
      ok: false,
      state: "skipped_missing_api_key",
      model: config.model,
      notes: ["Live Gemini dev-provider call skipped because GEMINI_API_KEY is not configured."],
      diagnostic: {
        errorClass: "MissingEnv",
        providerCategory: "configuration"
      }
    };
  }

  try {
    const client = options.client ?? createRestGeminiClient(config);
    let response: GeminiGenerateResponse | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await client.generateContent({
          model: config.model,
          prompt,
          responseSchema
        });
        break;
      } catch (error) {
        const diagnostic = diagnosticFromError(error);

        if (attempt === 2 || !canRetry(diagnostic)) {
          throw error;
        }

        await delay(500 * (attempt + 1));
      }
    }

    if (!response) {
      return {
        ok: false,
        state: "empty_response",
        model: config.model,
        notes: ["Gemini returned no generated content response."],
        diagnostic: {
          errorClass: "EmptyResponse",
          providerCategory: "provider"
        }
      };
    }

    const content = response.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;

    if (!content) {
      return {
        ok: false,
        state: "empty_response",
        model: config.model,
        notes: ["Gemini returned an empty generated content message."],
        diagnostic: {
          errorClass: "EmptyResponse",
          providerCategory: "provider"
        }
      };
    }

    try {
      const json = parseJsonContent(content);
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        return {
          ok: false,
          state: "invalid_response",
          model: config.model,
          notes: schemaIssueNotes(parsed.error),
          diagnostic: {
            errorClass: "SchemaValidationError",
            providerCategory: "structured_output"
          }
        };
      }

      return {
        ok: true,
        data: parsed.data,
        model: config.model
      };
    } catch {
      return {
        ok: false,
        state: "invalid_response",
        model: config.model,
        notes: ["Gemini returned content that was not valid JSON."],
        diagnostic: {
          errorClass: "InvalidJson",
          providerCategory: "structured_output"
        }
      };
    }
  } catch (error) {
    return {
      ok: false,
      state: "request_failed",
      model: config.model,
      notes: ["Gemini dev-provider request failed; see sanitized diagnostic fields."],
      diagnostic: diagnosticFromError(error)
    };
  }
}

function createSafeFallbackPlan(mission: Mission): AgentTask[] {
  try {
    return createInitialAgentPlan(mission);
  } catch {
    return [];
  }
}

function fallbackPlan(
  mission: Mission,
  state: GeminiFallbackState,
  model: string,
  notes: string[],
  diagnostic: AiFailureDiagnostic
): AiPlanResult {
  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "fallback",
    state,
    model,
    tasks: createSafeFallbackPlan(mission),
    rationale: "Used deterministic core planning fallback. No live Gemini dev-provider plan was accepted.",
    notes,
    diagnostic
  };
}

function fallbackVerification(
  output: AgentOutput,
  state: GeminiFallbackState,
  model: string,
  notes: string[],
  diagnostic: AiFailureDiagnostic
): AiVerificationResult {
  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "fallback",
    state,
    model,
    verified: false,
    confidence: "unknown",
    notes,
    riskSignals: output.riskSignals,
    requiresHumanReview: true,
    diagnostic
  };
}

function fallbackFinalReport(
  outputs: AgentOutput[],
  state: GeminiFallbackState,
  model: string,
  notes: string[],
  diagnostic: AiFailureDiagnostic
): AiFinalReportResult {
  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "fallback",
    state,
    model,
    report: {
      title: "Wallet / Token Risk Report",
      status: "fallback",
      summary: "Gemini development-provider synthesis was not completed. This fallback report preserves specialist summaries.",
      riskLevel: "unknown",
      sections: outputs.map((output) => ({
        heading: output.taskId,
        body: `${output.summary} Evidence: ${output.evidence.join("; ") || "none recorded"}.`
      })),
      recommendations: ["Use Venice for the final sponsor AI path. Gemini output is development/testing only."],
      verificationSummary: "No live Gemini dev-provider synthesis result was accepted; human review is required."
    },
    notes,
    diagnostic
  };
}

function planPrompt(mission: Mission): string {
  return stringifyAiPromptPayload(buildMissionPlanPromptPayload(mission));
}

function verificationPrompt(output: AgentOutput): string {
  return stringifyAiPromptPayload(buildAgentOutputVerificationPromptPayload(output));
}

function finalReportPrompt(outputs: AgentOutput[]): string {
  return stringifyAiPromptPayload(buildFinalReportSynthesisPromptPayload(outputs));
}

function mapPlanToTasks(mission: Mission, payload: AiMissionPlanPayload): AgentTask[] {
  const usedIds = new Set<string>();

  return payload.tasks.map((task, index) => {
    const agentKind = task.agentKind as AgentKind;
    const baseId = `${mission.id}:${agentKind.replaceAll("_", "-")}`;
    const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    usedIds.add(id);

    return {
      id,
      missionId: mission.id,
      agentKind,
      objective: task.objective,
      budget: {
        amount: task.budgetAmount,
        currency: mission.budgetPolicy.totalBudget.currency,
        chainId: mission.budgetPolicy.totalBudget.chainId
      }
    };
  });
}

export async function planMissionWithGemini(
  mission: Mission,
  options: GeminiAdapterOptions = {}
): Promise<AiPlanResult> {
  const response = await requestGeminiJson(aiMissionPlanSchema, planPrompt(mission), aiMissionPlanJsonSchema, options);

  if (!response.ok) {
    return fallbackPlan(mission, response.state, response.model, response.notes, response.diagnostic);
  }

  const tasks = mapPlanToTasks(mission, response.data);

  if (!validateTaskBudgets(mission.budgetPolicy, tasks)) {
    return fallbackPlan(
      mission,
      "policy_rejected",
      response.model,
      ["Gemini returned a plan that exceeded mission budget policy; deterministic core fallback was used."],
      {
        errorClass: "CorePolicyRejected",
        providerCategory: "request_format"
      }
    );
  }

  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "dev",
    state: "completed",
    model: response.model,
    tasks,
    rationale: response.data.rationale,
    notes: response.data.assumptions
  };
}

export async function verifyAgentOutputWithGemini(
  output: AgentOutput,
  options: GeminiAdapterOptions = {}
): Promise<AiVerificationResult> {
  const response = await requestGeminiJson(
    aiAgentOutputVerificationSchema,
    verificationPrompt(output),
    aiAgentOutputVerificationJsonSchema,
    options
  );

  if (!response.ok) {
    return fallbackVerification(output, response.state, response.model, response.notes, response.diagnostic);
  }

  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "dev",
    state: "completed",
    model: response.model,
    verified: response.data.verified,
    confidence: response.data.confidence,
    notes: response.data.notes,
    riskSignals: response.data.riskSignals,
    requiresHumanReview: response.data.requiresHumanReview
  };
}

export async function synthesizeFinalReportWithGemini(
  outputs: AgentOutput[],
  options: GeminiAdapterOptions = {}
): Promise<AiFinalReportResult> {
  const response = await requestGeminiJson(
    aiFinalReportSynthesisSchema,
    finalReportPrompt(outputs),
    aiFinalReportSynthesisJsonSchema,
    options
  );

  if (!response.ok) {
    return fallbackFinalReport(outputs, response.state, response.model, response.notes, response.diagnostic);
  }

  return {
    provider: "gemini",
    providerRole: "development_testing",
    mode: "dev",
    state: "completed",
    model: response.model,
    report: {
      title: response.data.title,
      status: "synthesized",
      summary: response.data.summary,
      riskLevel: response.data.riskLevel,
      sections: response.data.sections,
      recommendations: response.data.recommendations,
      verificationSummary: response.data.verificationSummary
    },
    notes: []
  };
}

export const geminiDevProvider: AiProviderClient = {
  id: "gemini",
  role: "development_testing",
  async planMission(mission, options) {
    return planMissionWithGemini(mission, options);
  },
  async verifyAgentOutput(output, options) {
    return verifyAgentOutputWithGemini(output, options);
  },
  async synthesizeFinalReport(outputs, options) {
    return synthesizeFinalReportWithGemini(outputs, options);
  }
};
