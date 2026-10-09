import { z } from "zod";

export const policySchema = z
  .object({
    enabled: z.boolean(),
    first_response_target_seconds: z.number().int().positive().max(2147483647).nullable(),
    resolution_target_seconds: z.number().int().positive().max(2147483647).nullable(),
    clock_mode: z.literal("elapsed"),
  })
  .strict()
  .refine(
    (p) =>
      !p.enabled ||
      p.first_response_target_seconds !== null ||
      p.resolution_target_seconds !== null,
    { message: "target_required" },
  );
export type QualityPolicy = z.infer<typeof policySchema>;
export const DISABLED_POLICY: QualityPolicy = {
  enabled: false,
  first_response_target_seconds: null,
  resolution_target_seconds: null,
  clock_mode: "elapsed",
};
export const requestSurveySchema = z
  .object({ conversation_id: z.string().uuid(), expires_hours: z.number().int().min(1).max(720) })
  .strict();
export const surveyTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const feedbackSchema = z
  .object({
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();
export const listQuerySchema = z
  .object({
    after: z.string().uuid().optional(),
    conversation_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const factSchema = z.object({
  conversation_id: z.string().uuid(),
  status: z.string(),
  service_started_at: z.string().nullable(),
  first_inbound_at: z.string().nullable(),
  first_response_at: z.string().nullable(),
  closed_at: z.string().nullable(),
});
export type QualityFact = z.infer<typeof factSchema>;
export const surveySchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  created_at: z.string(),
  expires_at: z.string(),
  responded_at: z.string().nullable(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
});
export type QualitySurvey = z.infer<typeof surveySchema>;

export const surveySummarySchema = z.object({
  total: z.number(),
  csat_responses: z.number(),
  csat_average: z.number().nullable(),
  csat_low_scores: z.number(),
  pending_surveys: z.number(),
  expired_surveys: z.number(),
});
export const surveyHistorySchema = z.object({
  surveys: z.array(surveySchema),
  summary: surveySummarySchema,
});
