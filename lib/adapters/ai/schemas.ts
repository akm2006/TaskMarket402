import { z } from "zod";

const specialistAgentKindSchema = z.enum(["contract_scanner", "wallet_behavior", "market_context"]);
const riskLevelSchema = z.enum(["low", "medium", "high", "unknown"]);
const confidenceSchema = z.enum(["low", "medium", "high", "unknown"]);

export const aiMissionPlanSchema = z.object({
  rationale: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  tasks: z
    .array(
      z.object({
        agentKind: specialistAgentKindSchema,
        objective: z.string().min(1),
        budgetAmount: z.string().regex(/^\d+(\.\d{1,6})?$/)
      })
    )
    .min(1)
});

export const aiAgentOutputVerificationSchema = z.object({
  verified: z.boolean(),
  confidence: confidenceSchema,
  notes: z.array(z.string()).default([]),
  riskSignals: z.array(z.string()).default([]),
  requiresHumanReview: z.boolean()
});

export const aiFinalReportSynthesisSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  riskLevel: riskLevelSchema,
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1)
      })
    )
    .min(1),
  recommendations: z.array(z.string()).default([]),
  verificationSummary: z.string().min(1)
});

export type AiMissionPlanPayload = z.infer<typeof aiMissionPlanSchema>;
export type AiAgentOutputVerificationPayload = z.infer<typeof aiAgentOutputVerificationSchema>;
export type AiFinalReportSynthesisPayload = z.infer<typeof aiFinalReportSynthesisSchema>;

const stringArrayJsonSchema = {
  type: "array",
  items: {
    type: "string"
  }
} as const;

export const aiMissionPlanJsonSchema = {
  type: "object",
  properties: {
    rationale: { type: "string" },
    assumptions: stringArrayJsonSchema,
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          agentKind: {
            type: "string",
            enum: ["contract_scanner", "wallet_behavior", "market_context"]
          },
          objective: { type: "string" },
          budgetAmount: { type: "string" }
        },
        required: ["agentKind", "objective", "budgetAmount"],
        propertyOrdering: ["agentKind", "objective", "budgetAmount"]
      }
    }
  },
  required: ["rationale", "tasks"],
  propertyOrdering: ["rationale", "assumptions", "tasks"]
} as const;

export const aiAgentOutputVerificationJsonSchema = {
  type: "object",
  properties: {
    verified: { type: "boolean" },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high", "unknown"]
    },
    notes: stringArrayJsonSchema,
    riskSignals: stringArrayJsonSchema,
    requiresHumanReview: { type: "boolean" }
  },
  required: ["verified", "confidence", "notes", "riskSignals", "requiresHumanReview"],
  propertyOrdering: ["verified", "confidence", "notes", "riskSignals", "requiresHumanReview"]
} as const;

export const aiFinalReportSynthesisJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    riskLevel: {
      type: "string",
      enum: ["low", "medium", "high", "unknown"]
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" }
        },
        required: ["heading", "body"],
        propertyOrdering: ["heading", "body"]
      }
    },
    recommendations: stringArrayJsonSchema,
    verificationSummary: { type: "string" }
  },
  required: ["title", "summary", "riskLevel", "sections", "recommendations", "verificationSummary"],
  propertyOrdering: ["title", "summary", "riskLevel", "sections", "recommendations", "verificationSummary"]
} as const;
