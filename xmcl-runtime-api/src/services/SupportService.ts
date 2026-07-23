import { z } from 'zod'
import type { ServiceKey } from './Service'

export const SupportTicketTypeSchema = z.enum([
  'refund_request',
  'account_deletion',
  'server_appeal',
  'error_feedback',
])

export const SupportTicketStatusSchema = z.enum([
  'submitted',
  'in_review',
  'waiting_for_user',
  'resolved',
  'rejected',
])

const SupportTicketSubmissionBaseSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4_000),
}).strict()

export const RefundSupportTicketSubmissionSchema = SupportTicketSubmissionBaseSchema.extend({
  type: z.literal('refund_request'),
  purchaseReference: z.string().trim().min(1).max(128),
}).strict()

export const AccountDeletionSupportTicketSubmissionSchema = SupportTicketSubmissionBaseSchema.extend({
  type: z.literal('account_deletion'),
  confirmation: z.literal('DELETE'),
}).strict()

export const ServerAppealSupportTicketSubmissionSchema = SupportTicketSubmissionBaseSchema.extend({
  type: z.literal('server_appeal'),
  serverId: z.string().trim().min(1).max(128),
}).strict()

export const ErrorFeedbackSupportTicketSubmissionSchema = SupportTicketSubmissionBaseSchema.extend({
  type: z.literal('error_feedback'),
  errorCode: z.string().trim().min(1).max(128).optional(),
  launcherVersion: z.string().trim().min(1).max(64).optional(),
}).strict()

export const SupportTicketSubmissionSchema = z.discriminatedUnion('type', [
  RefundSupportTicketSubmissionSchema,
  AccountDeletionSupportTicketSubmissionSchema,
  ServerAppealSupportTicketSubmissionSchema,
  ErrorFeedbackSupportTicketSubmissionSchema,
])

export const SupportTicketResourceSchema = z.object({
  type: z.literal('server'),
  id: z.string().min(1),
}).strict()

export const SupportTicketSchema = z.object({
  ticketId: z.string().min(1),
  type: SupportTicketTypeSchema,
  subject: z.string().min(1),
  status: SupportTicketStatusSchema,
  statusVersion: z.number().int().nonnegative(),
  resource: SupportTicketResourceSchema.optional(),
  requiresUserAction: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const SupportTicketCreateResultSchema = z.object({
  requestId: z.string().min(1),
  replayed: z.boolean(),
  ticket: SupportTicketSchema,
}).strict()

export type SupportTicketType = z.infer<typeof SupportTicketTypeSchema>
export type SupportTicketStatus = z.infer<typeof SupportTicketStatusSchema>
export type SupportTicketSubmission = z.infer<typeof SupportTicketSubmissionSchema>
export type SupportTicket = z.infer<typeof SupportTicketSchema>
export type SupportTicketCreateResult = z.infer<typeof SupportTicketCreateResultSchema>

/**
 * Reject credentials and full payment data before a support request leaves the
 * launcher. The service deliberately accepts only support-safe references.
 */
export function assertSafeSupportContent(content: string): void {
  const sensitivePatterns = [
    /\b(?:oauth|access|refresh)[\s_-]*token\b\s*[:=]/i,
    /\b(?:client[\s_-]*secret|api[\s_-]*key)\b\s*[:=]/i,
    /\bbearer\s+[a-z0-9._~+/-]+=*/i,
    /\b(?:\d[ -]*?){13,19}\b/,
    /\b(?:card(?:[\s_-]*number)?|cvv|cvc|iban|routing[\s_-]*number|bank[\s_-]*account(?:[\s_-]*number)?)\b\s*[:=]/i,
  ]
  if (sensitivePatterns.some(pattern => pattern.test(content))) {
    throw new SensitiveSupportContentError()
  }
}

export function assertSafeSupportSubmission(submission: SupportTicketSubmission): void {
  for (const value of Object.values(submission)) {
    if (typeof value === 'string') assertSafeSupportContent(value)
  }
}

export class SensitiveSupportContentError extends Error {
  readonly code = 'sensitive_content'

  constructor() {
    super('Support requests cannot contain credentials or full payment details.')
    this.name = 'SensitiveSupportContentError'
  }
}

/**
 * User-scoped support API. It intentionally has no administrator, ledger, or
 * server-control methods; M7 admin operations remain server-side only.
 */
export interface SupportService {
  listTickets(): Promise<SupportTicket[]>
  createTicket(request: SupportTicketSubmission): Promise<SupportTicketCreateResult>
}

export const SupportServiceKey: ServiceKey<SupportService> = 'SupportService'
