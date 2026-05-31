import OpenAI from "openai";
import { z } from "zod";
import { createInitialAgentPlan } from "../../core/agent-orchestrator";
import { validateTaskBudgets } from "../../core/policy";
import type {
  AgentKind,
  AgentOutput,
  AgentTask,
  FinalReport,
  Mission,
  VeniceConfidence,
  VeniceExecutionMode,
  VeniceResultState
} from "../../core/types";
import {
  aiAgentOutputVerificationSchema,
  aiFinalReportSynthesisSchema,
  aiMissionPlanSchema,
  type AiMissionPlanPayload
} from "./schemas";
import {
  TASKMARKET_AI_REASONING_INSTRUCTION,
  buildAgentOutputVerificationPromptPayload,
  buildFinalReportSynthesisPromptPayload,
  buildMissionPlanPromptPayload,
  stringifyAiPromptPayload
} from "./prompts";

const DEFAULT_VENICE_BASE_URL = "https://api.venice.ai/api/v1";
const DEFAULT_VENICE_MODEL = "zai-org-glm-5-1";

export const veniceMissionPlanSchema = aiMissionPlanSchema;
export const veniceAgentOutputVerificationSchema = aiAgentOutputVerificationSchema;
export const veniceFinalReportSynthesisSchema = aiFinalReportSynthesisSchema;

type VeniceMissionPlanPayload = AiMissionPlanPayload;

type VeniceFallbackState = Exclude<VeniceResultState, "completed">;
type VeniceProviderCategory =
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

export interface VeniceFailureDiagnostic {
  statusCode?: number;
  errorClass: string;
  providerCategory: VeniceProviderCategory;
  providerCode?: string;
}

interface VeniceMessage {
  role: "system" | "user";
  content: string;
}

interface VeniceChatRequest {
  model: string;
  messages: VeniceMessage[];
  temperature: number;
  max_tokens: number;
  response_format: { type: "json_object" };
}

interface VeniceChatCompletion {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  }>;
}

export interface VeniceChatClient {
  chat: {
    completions: {
      create(request: VeniceChatRequest): Promise<VeniceChatCompletion>;
    };
  };
}

export interface VeniceAdapterOptions {
  env?: Record<string, string | undefined>;
  client?: VeniceChatClient;
  model?: string;
  baseURL?: string;
}

export interface VenicePlanResult {
  mode: VeniceExecutionMode;
  state: VeniceResultState;
  model: string;
  tasks: AgentTask[];
  rationale: string;
  notes: string[];
  diagnostic?: VeniceFailureDiagnostic;
}

export interface VeniceVerificationResult {
  mode: VeniceExecutionMode;
  state: VeniceResultState;
  model: string;
  verified: boolean;
  confidence: VeniceConfidence;
  notes: string[];
  riskSignals: string[];
  requiresHumanReview: boolean;
  diagnostic?: VeniceFailureDiagnostic;
}

export interface VeniceFinalReport {
  mode: VeniceExecutionMode;
  state: VeniceResultState;
  model: string;
  report: FinalReport;
  notes: string[];
  diagnostic?: VeniceFailureDiagnostic;
}

interface VeniceConfig {
  apiKey?: string;
  baseURL: string;
  model: string;
}

interface VeniceJsonSuccess<T> {
  ok: true;
  data: T;
  model: string;
}

interface VeniceJsonFailure {
  ok: false;
  state: VeniceFallbackState;
  model: string;
  notes: string[];
  diagnostic: VeniceFailureDiagnostic;
}

function resolveConfig(options: VeniceAdapterOptions): VeniceConfig {
  const env = options.env ?? process.env;

  return {
    apiKey: env.VENICE_API_KEY,
    baseURL: options.baseURL ?? env.VENICE_BASE_URL ?? DEFAULT_VENICE_BASE_URL,
    model: options.model ?? env.VENICE_MODEL ?? DEFAULT_VENICE_MODEL
  };
}

function createVeniceClient(config: VeniceConfig): VeniceChatClient {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  }) as unknown as VeniceChatClient;
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

function readNumberField(value: unknown, key: string): number | undefined {
  const record = recordFromUnknown(value);
  const field = record?.[key];

  return typeof field === "number" ? field : undefined;
}

function readNestedStringField(value: unknown, outerKey: string, key: string): string | undefined {
  return readStringField(recordFromUnknown(value)?.[outerKey], key);
}

function providerCategory(statusCode: number | undefined, providerCode: string | undefined, message: string): VeniceProviderCategory {
  const normalizedCode = providerCode?.toLowerCase() ?? "";
  const normalizedMessage = message.toLowerCase();

  if (statusCode === 401 || statusCode === 403 || normalizedCode.includes("auth") || normalizedCode.includes("api_key")) {
    return "auth";
  }

  if (
    statusCode === 402 ||
    normalizedCode.includes("insufficient_balance") ||
    normalizedMessage.includes("insufficient") ||
    normalizedMessage.includes("balance") ||
    normalizedMessage.includes("credit") ||
    normalizedMessage.includes("quota")
  ) {
    return "credits_billing";
  }

  if (statusCode === 429 || normalizedCode.includes("rate")) {
    return "rate_limit";
  }

  if (statusCode === 404 && normalizedCode.includes("model")) {
    return "model";
  }

  if (statusCode === 400 && (normalizedCode.includes("model") || normalizedMessage.includes("model"))) {
    return "model";
  }

  if (statusCode === 400 || statusCode === 415 || normalizedCode.includes("invalid_request")) {
    return "request_format";
  }

  if (normalizedMessage.includes("fetch") || normalizedMessage.includes("network") || normalizedMessage.includes("timeout")) {
    return "network";
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return "provider";
  }

  return "unknown";
}

function diagnosticFromError(error: unknown): VeniceFailureDiagnostic {
  const statusCode = readNumberField(error, "status");
  const providerCode = readStringField(error, "code") ?? readNestedStringField(error, "error", "code");
  const errorClass = error instanceof Error ? error.constructor.name : "UnknownError";
  const message = error instanceof Error ? error.message : "";

  return {
    statusCode,
    errorClass,
    providerCategory: providerCategory(statusCode, providerCode, message),
    providerCode
  };
}

function schemaErrorNotes(error: z.ZodError): string[] {
  return error.issues.slice(0, 3).map((issue) => `Invalid Venice response: ${issue.path.join(".") || "root"} ${issue.message}`);
}

async function requestVeniceJson<T>(
  schema: z.ZodType<T>,
  messages: VeniceMessage[],
  options: VeniceAdapterOptions
): Promise<VeniceJsonSuccess<T> | VeniceJsonFailure> {
  const config = resolveConfig(options);

  if (!config.apiKey) {
    return {
      ok: false,
      state: "skipped_missing_api_key",
      model: config.model,
      notes: ["Live Venice call skipped because VENICE_API_KEY is not configured."],
      diagnostic: {
        errorClass: "MissingEnv",
        providerCategory: "configuration"
      }
    };
  }

  const client = options.client ?? createVeniceClient(config);

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature: 0.2,
      max_tokens: 1400,
      response_format: { type: "json_object" }
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return {
        ok: false,
        state: "empty_response",
        model: config.model,
        notes: ["Venice returned an empty chat completion message."],
        diagnostic: {
          errorClass: "EmptyResponse",
          providerCategory: "provider"
        }
      };
    }

    let json: unknown;

    try {
      json = JSON.parse(content);
    } catch {
      return {
        ok: false,
        state: "invalid_response",
        model: config.model,
        notes: ["Venice returned content that was not valid JSON."],
        diagnostic: {
          errorClass: "InvalidJson",
          providerCategory: "structured_output"
        }
      };
    }

    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      return {
        ok: false,
        state: "invalid_response",
        model: config.model,
        notes: schemaErrorNotes(parsed.error),
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
  } catch (error) {
    const diagnostic = diagnosticFromError(error);

    return {
      ok: false,
      state: "request_failed",
      model: config.model,
      notes: ["Venice request failed; see sanitized diagnostic fields."],
      diagnostic
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
  state: VeniceFallbackState,
  model: string,
  notes: string[],
  diagnostic?: VeniceFailureDiagnostic
): VenicePlanResult {
  return {
    mode: "fallback",
    state,
    model,
    tasks: createSafeFallbackPlan(mission),
    rationale: "Used deterministic core planning fallback. No live Venice plan was accepted.",
    notes,
    diagnostic
  };
}

function fallbackVerification(
  output: AgentOutput,
  state: VeniceFallbackState,
  model: string,
  notes: string[],
  diagnostic?: VeniceFailureDiagnostic
): VeniceVerificationResult {
  return {
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
  state: VeniceFallbackState,
  model: string,
  notes: string[],
  diagnostic?: VeniceFailureDiagnostic
): VeniceFinalReport {
  return {
    mode: "fallback",
    state,
    model,
    report: {
      title: "Wallet / Token Risk Report",
      status: "fallback",
      summary: "Live Venice synthesis was not completed. This fallback report preserves the specialist summaries for review.",
      riskLevel: "unknown",
      sections: outputs.map((output) => ({
        heading: output.taskId,
        body: `${output.summary} Evidence: ${output.evidence.join("; ") || "none recorded"}.`
      })),
      recommendations: ["Configure and verify Venice before using this report as a real AI synthesis."],
      verificationSummary: "No live Venice synthesis result was accepted; human review is required."
    },
    notes,
    diagnostic
  };
}

function planPrompt(mission: Mission): VeniceMessage[] {
  return [
    {
      role: "system",
      content: `${TASKMARKET_AI_REASONING_INSTRUCTION} Follow the user payload and return JSON only.`
    },
    {
      role: "user",
      content: stringifyAiPromptPayload(buildMissionPlanPromptPayload(mission))
    }
  ];
}

function verificationPrompt(output: AgentOutput): VeniceMessage[] {
  return [
    {
      role: "system",
      content: `${TASKMARKET_AI_REASONING_INSTRUCTION} Follow the user payload and return JSON only.`
    },
    {
      role: "user",
      content: stringifyAiPromptPayload(buildAgentOutputVerificationPromptPayload(output))
    }
  ];
}

function finalReportPrompt(outputs: AgentOutput[]): VeniceMessage[] {
  return [
    {
      role: "system",
      content: `${TASKMARKET_AI_REASONING_INSTRUCTION} Follow the user payload and return JSON only.`
    },
    {
      role: "user",
      content: stringifyAiPromptPayload(buildFinalReportSynthesisPromptPayload(outputs))
    }
  ];
}

function mapPlanToTasks(mission: Mission, payload: VeniceMissionPlanPayload): AgentTask[] {
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

export async function planMissionWithVenice(
  mission: Mission,
  options: VeniceAdapterOptions = {}
): Promise<VenicePlanResult> {
  const response = await requestVeniceJson(veniceMissionPlanSchema, planPrompt(mission), options);

  if (!response.ok) {
    return fallbackPlan(mission, response.state, response.model, response.notes, response.diagnostic);
  }

  const tasks = mapPlanToTasks(mission, response.data);

  if (!validateTaskBudgets(mission.budgetPolicy, tasks)) {
    return fallbackPlan(
      mission,
      "policy_rejected",
      response.model,
      ["Venice returned a plan that exceeded mission budget policy; deterministic core fallback was used."],
      {
        errorClass: "CorePolicyRejected",
        providerCategory: "request_format"
      }
    );
  }

  return {
    mode: "live",
    state: "completed",
    model: response.model,
    tasks,
    rationale: response.data.rationale,
    notes: response.data.assumptions
  };
}

export async function verifyAgentOutputWithVenice(
  output: AgentOutput,
  options: VeniceAdapterOptions = {}
): Promise<VeniceVerificationResult> {
  const response = await requestVeniceJson(veniceAgentOutputVerificationSchema, verificationPrompt(output), options);

  if (!response.ok) {
    return fallbackVerification(output, response.state, response.model, response.notes, response.diagnostic);
  }

  return {
    mode: "live",
    state: "completed",
    model: response.model,
    verified: response.data.verified,
    confidence: response.data.confidence,
    notes: response.data.notes,
    riskSignals: response.data.riskSignals,
    requiresHumanReview: response.data.requiresHumanReview
  };
}

export async function synthesizeFinalReportWithVenice(
  outputs: AgentOutput[],
  options: VeniceAdapterOptions = {}
): Promise<VeniceFinalReport> {
  const response = await requestVeniceJson(veniceFinalReportSynthesisSchema, finalReportPrompt(outputs), options);

  if (!response.ok) {
    return fallbackFinalReport(outputs, response.state, response.model, response.notes, response.diagnostic);
  }

  return {
    mode: "live",
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
