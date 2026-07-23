import { z } from 'zod'
import { ServiceKey } from './Service'

export const AiApiErrorCodeSchema = z.enum([
  'invalid_ai_request',
  'ai_unauthenticated',
  'ai_forbidden',
  'insufficient_balance',
  'ai_authorization_conflict',
  'ai_provider_unavailable',
  'ai_request_failed',
  'invalid_ai_response',
])

export const AiApiErrorSchema = z.object({
  error: AiApiErrorCodeSchema,
  message: z.string(),
  requestId: z.string().min(1),
  details: z.unknown().optional(),
}).strict()

export const AiUsageResourceSchema = z.enum(['ai_request', 'ai_tokens'])

export const AiUsageSchema = z.discriminatedUnion('resource', [
  z.object({
    resource: z.literal('ai_request'),
    quantity: z.number().int().nonnegative(),
    unit: z.literal('request'),
  }).strict(),
  z.object({
    resource: z.literal('ai_tokens'),
    quantity: z.number().int().nonnegative(),
    unit: z.literal('token'),
  }).strict(),
])

export const AiMoneySchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict()

export const AiCashRateSchema = z.discriminatedUnion('resource', [
  z.object({
    resource: z.literal('ai_request'),
    unit: z.literal('request'),
    rateVersion: z.number().int().nonnegative(),
    price: AiMoneySchema,
  }).strict(),
  z.object({
    resource: z.literal('ai_tokens'),
    unit: z.literal('token'),
    rateVersion: z.number().int().nonnegative(),
    price: AiMoneySchema,
  }).strict(),
])

export const AiModelSchema = z.object({
  model: z.string().min(1),
  capability: z.string().min(1),
  usageResources: z.array(AiUsageResourceSchema).min(1),
  rates: z.array(AiCashRateSchema).optional(),
}).strict()

export const AiModelsSchema = z.array(AiModelSchema)

export const AiRequestSchema = z.object({
  capability: z.string().min(1),
  model: z.string().min(1).optional(),
  input: z.string().min(1),
  idempotencyKey: z.string().min(1),
}).strict()

export const AiResultSchema = z.object({
  requestId: z.string().min(1),
  providerRequestId: z.string().min(1),
  output: z.string(),
  usage: z.array(AiUsageSchema).min(1),
}).strict()

export const AiUsageRecordSchema = z.object({
  usageEventId: z.string().min(1),
  requestId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  rateVersion: z.number().int().nonnegative(),
  charged: AiMoneySchema,
  status: z.enum(['settled', 'rejected', 'pending']),
  usage: AiUsageSchema,
}).strict()

export const AiUsagePageSchema = z.object({
  items: z.array(AiUsageRecordSchema),
  nextCursor: z.string().min(1).optional(),
}).strict().superRefine((page, context) => {
  const eventIds = new Set<string>()
  for (const [index, item] of page.items.entries()) {
    if (eventIds.has(item.usageEventId)) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate usageEventId',
        path: ['items', index, 'usageEventId'],
      })
    }
    eventIds.add(item.usageEventId)
  }
})

export interface AiUsageQuery {
  cursor?: string
}

export type AiApiErrorCode = z.infer<typeof AiApiErrorCodeSchema>
export type AiApiError = z.infer<typeof AiApiErrorSchema>
export type AiUsageResource = z.infer<typeof AiUsageResourceSchema>
export type AiUsage = z.infer<typeof AiUsageSchema>
export type AiMoney = z.infer<typeof AiMoneySchema>
export type AiCashRate = z.infer<typeof AiCashRateSchema>
export type AiModel = z.infer<typeof AiModelSchema>
export type AiRequest = z.infer<typeof AiRequestSchema>
export type AiResult = z.infer<typeof AiResultSchema>
export type AiUsageRecord = z.infer<typeof AiUsageRecordSchema>
export type AiUsagePage = z.infer<typeof AiUsagePageSchema>

export interface AiService {
  getModels(): Promise<AiModel[]>
  request(request: AiRequest): Promise<AiResult>
  getUsage(query?: AiUsageQuery): Promise<AiUsagePage>
}

export const AiServiceKey: ServiceKey<AiService> = 'AiService'