import {
  assertSafeSupportSubmission,
  type SupportService,
  type SupportTicket,
  type SupportTicketCreateResult,
  type SupportTicketStatus,
  SupportTicketSubmissionSchema,
  type SupportTicketSubmission,
} from './SupportService'

export type SupportServiceFailureCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'provider_unavailable'
  | 'idempotency_conflict'

export class SupportServiceError extends Error {
  constructor(
    readonly code: SupportServiceFailureCode,
    readonly retryable = false,
  ) {
    super(code)
    this.name = 'SupportServiceError'
  }
}

export interface SupportServiceMockOptions {
  authenticated?: boolean
  allowedServerIds?: readonly string[]
  createFailures?: SupportServiceFailureCode[]
  now?: () => string
}

export interface SupportTicketUpdateFixture {
  status: SupportTicketStatus
  statusVersion: number
  updatedAt: string
  requiresUserAction?: boolean
}

/**
 * M7-local consumer mock. It models the published user support surface while
 * keeping administrative commands and provider credentials out of the app.
 */
export class SupportServiceMock implements SupportService {
  private readonly tickets = new Map<string, SupportTicket>()
  private readonly idempotency = new Map<string, { fingerprint: string; ticketId: string }>()
  private readonly failures: SupportServiceFailureCode[]
  private readonly allowedServerIds?: Set<string>
  private sequence = 0

  constructor(private readonly options: SupportServiceMockOptions = {}) {
    this.failures = [...(options.createFailures ?? [])]
    this.allowedServerIds = options.allowedServerIds ? new Set(options.allowedServerIds) : undefined
  }

  async listTickets(): Promise<SupportTicket[]> {
    this.assertAuthenticated()
    return [...this.tickets.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createTicket(input: SupportTicketSubmission): Promise<SupportTicketCreateResult> {
    this.assertAuthenticated()
    const request = SupportTicketSubmissionSchema.parse(input)
    assertSafeSupportSubmission(request)
    if (request.type === 'server_appeal' && this.allowedServerIds && !this.allowedServerIds.has(request.serverId)) {
      throw new SupportServiceError('forbidden')
    }

    const fingerprint = JSON.stringify(request)
    const previous = this.idempotency.get(request.idempotencyKey)
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new SupportServiceError('idempotency_conflict')
      }
      return {
        requestId: this.nextRequestId(),
        replayed: true,
        ticket: this.tickets.get(previous.ticketId)!,
      }
    }

    const failure = this.failures.shift()
    if (failure) {
      throw new SupportServiceError(failure, failure === 'provider_unavailable')
    }

    const now = this.options.now?.() ?? new Date().toISOString()
    const ticket: SupportTicket = {
      ticketId: `ticket_${++this.sequence}`,
      type: request.type,
      subject: request.subject,
      status: 'submitted',
      statusVersion: 0,
      resource: request.type === 'server_appeal' ? { type: 'server', id: request.serverId } : undefined,
      requiresUserAction: false,
      createdAt: now,
      updatedAt: now,
    }
    this.tickets.set(ticket.ticketId, ticket)
    this.idempotency.set(request.idempotencyKey, { fingerprint, ticketId: ticket.ticketId })
    return { requestId: this.nextRequestId(), replayed: false, ticket }
  }

  applyTicketUpdate(ticketId: string, update: SupportTicketUpdateFixture): SupportTicket {
    const current = this.tickets.get(ticketId)
    if (!current) throw new RangeError(`Unknown support ticket: ${ticketId}`)
    if (update.statusVersion <= current.statusVersion) return current

    const ticket: SupportTicket = {
      ...current,
      status: update.status,
      statusVersion: update.statusVersion,
      updatedAt: update.updatedAt,
      requiresUserAction: update.requiresUserAction ?? update.status === 'waiting_for_user',
    }
    this.tickets.set(ticketId, ticket)
    return ticket
  }

  private assertAuthenticated() {
    if (this.options.authenticated === false) {
      throw new SupportServiceError('unauthenticated')
    }
  }

  private nextRequestId() {
    return `request_${++this.sequence}`
  }
}
