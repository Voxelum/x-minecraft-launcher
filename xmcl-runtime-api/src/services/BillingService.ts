import { z } from 'zod'
import type { ServiceKey } from './Service'

export const BILLING_CONTRACT = 'm3.billing.v1-proposal'

export const BillingResourceSchema = z.enum([
  'server_time',
  'ai_request',
  'ai_tokens',
  'storage_retention',
])
export const BillingMeterUnitSchema = z.enum(['second', 'request', 'token', 'byte_second'])
export const MoneySchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    amountMinor: z.number().int().nonnegative().safe(),
  })
  .strict()

export const BillingBalanceSchema = z
  .object({
    accountId: z.string().min(1),
    available: MoneySchema,
    reserved: MoneySchema,
  })
  .strict()

export const CashRateSchema = z
  .object({
    rateVersion: z.number().int().positive().safe(),
    resource: BillingResourceSchema,
    unit: BillingMeterUnitSchema,
    amountMinorPerUnit: z.number().int().nonnegative().safe(),
    effectiveAt: z.string().datetime(),
    retiredAt: z.string().datetime().optional(),
  })
  .strict()

export const UsageAuthorizationRequestSchema = z
  .object({
    accountId: z.string().min(1),
    resource: BillingResourceSchema,
    sourceId: z.string().min(1),
    expectedQuantity: z.number().int().positive().safe(),
    unit: BillingMeterUnitSchema,
    settlementIntervalSeconds: z.number().int().positive().safe(),
    rateVersion: z.number().int().positive().safe(),
    idempotencyKey: z.string().min(1).max(255),
    expiresAt: z.string().datetime(),
  })
  .strict()

export const UsageAuthorizationSchema = z
  .object({
    authorizationId: z.string().min(1),
    accountId: z.string().min(1),
    resource: BillingResourceSchema,
    sourceId: z.string().min(1),
    status: z.enum(['authorized', 'rejected', 'expired', 'released']),
    rateVersion: z.number().int().positive().safe(),
    expiresAt: z.string().datetime(),
    actionOnExhaustion: z.literal('stop_required'),
  })
  .strict()

export const CanonicalUsageEventSchema = z
  .object({
    eventType: z.literal('usage.recorded.v1'),
    eventId: z.string().min(1),
    schemaVersion: z.literal(1),
    accountId: z.string().min(1),
    authorizationId: z.string().min(1),
    resource: BillingResourceSchema,
    sourceId: z.string().min(1),
    quantity: z.number().int().positive().safe(),
    unit: BillingMeterUnitSchema,
    rateVersion: z.number().int().positive().safe(),
    sequence: z.number().int().positive().safe().optional(),
    intervalStart: z.string().datetime(),
    intervalEnd: z.string().datetime(),
    occurredAt: z.string().datetime(),
    idempotencyKey: z.string().min(1).max(255),
  })
  .strict()

export const UsageSettlementResultSchema = z
  .object({
    settlementId: z.string().min(1),
    usageEventId: z.string().min(1),
    action: z.enum(['continue', 'stop_required']),
    status: z.enum(['settled', 'rejected', 'pending']),
    rateVersion: z.number().int().positive().safe(),
    charged: MoneySchema.optional(),
    ledgerEntryId: z.string().min(1).optional(),
  })
  .strict()

export const BillingLedgerEntrySchema = z
  .object({
    ledgerEntryId: z.string().min(1),
    accountId: z.string().min(1),
    kind: z.enum(['top_up', 'reservation', 'usage_charge', 'refund', 'balance_adjust']),
    amount: MoneySchema,
    occurredAt: z.string().datetime(),
    orderId: z.string().min(1).optional(),
    settlementId: z.string().min(1).optional(),
  })
  .strict()

export const BillingLedgerPageSchema = z
  .object({
    items: z.array(BillingLedgerEntrySchema),
    nextCursor: z.string().min(1).optional(),
  })
  .strict()

export const BillingUsagePageSchema = z
  .object({
    items: z.array(UsageSettlementResultSchema),
    nextCursor: z.string().min(1).optional(),
  })
  .strict()

export const PaypalOrderStatusSchema = z.enum([
  'approval_required',
  'approved',
  'capturing',
  'pending',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'failed',
])

export const PaypalOrderSchema = z
  .object({
    orderId: z.string().min(1),
    status: PaypalOrderStatusSchema,
    approvalUrl: z.string().url().optional(),
    cashAmount: MoneySchema.optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict()

export const PaypalOrderPageSchema = z
  .object({
    items: z.array(PaypalOrderSchema),
    nextCursor: z.string().min(1).optional(),
  })
  .strict()

export const PaypalOrderIntentSchema = z
  .object({
    intentId: z.string().min(1).max(255),
    accountId: z.string().min(1),
    cashAmount: MoneySchema.refine((money) => money.amountMinor > 0, 'cashAmount must be positive'),
  })
  .strict()

export const BillingApiErrorSchema = z
  .object({
    error: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict()

export type BillingResource = z.infer<typeof BillingResourceSchema>
export type BillingMeterUnit = z.infer<typeof BillingMeterUnitSchema>
export type Money = z.infer<typeof MoneySchema>
export type BillingBalance = z.infer<typeof BillingBalanceSchema>
export type CashRate = z.infer<typeof CashRateSchema>
export type UsageAuthorizationRequest = z.infer<typeof UsageAuthorizationRequestSchema>
export type UsageAuthorization = z.infer<typeof UsageAuthorizationSchema>
export type CanonicalUsageEvent = z.infer<typeof CanonicalUsageEventSchema>
export type UsageSettlementResult = z.infer<typeof UsageSettlementResultSchema>
export type BillingLedgerEntry = z.infer<typeof BillingLedgerEntrySchema>
export type BillingLedgerPage = z.infer<typeof BillingLedgerPageSchema>
export type BillingUsagePage = z.infer<typeof BillingUsagePageSchema>
export type PaypalOrder = z.infer<typeof PaypalOrderSchema>
export type PaypalOrderPage = z.infer<typeof PaypalOrderPageSchema>
export type PaypalOrderIntent = z.infer<typeof PaypalOrderIntentSchema>
export type BillingApiErrorBody = z.infer<typeof BillingApiErrorSchema>

export interface BillingPageOptions {
  cursor?: string
  limit?: number
}

export interface BillingPaymentStatus {
  order: PaypalOrder
  balance: BillingBalance
}

export type BillingErrorCategory = 'permission' | 'provider' | 'conflict' | 'network' | 'api'

export interface BillingApiClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  getSessionToken: () => string | undefined | Promise<string | undefined>
  createIdempotencyKey?: () => string
  maxAttempts?: number
}

export class BillingApiError extends Error {
  readonly name = 'BillingApiError'

  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    readonly requestId: string,
    readonly category: BillingErrorCategory,
    readonly retryable: boolean,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export interface BillingService {
  getBalance(): Promise<BillingBalance>
  getRates(): Promise<CashRate[]>
  getLedger(options?: BillingPageOptions): Promise<BillingLedgerPage>
  getUsage(options?: BillingPageOptions): Promise<BillingUsagePage>
  getPaypalOrders(options?: BillingPageOptions): Promise<PaypalOrderPage>
  createPaypalOrder(intent: PaypalOrderIntent): Promise<PaypalOrder>
  capturePaypalOrder(orderId: string): Promise<BillingPaymentStatus>
  refreshPaypalOrder(orderId: string): Promise<BillingPaymentStatus>
}

export const BillingServiceKey: ServiceKey<BillingService> = 'BillingService'

/**
 * Session-authenticated M3 consumer. It never contacts PayPal and only reads
 * server-owned money, ledger, order, rate, and settlement state.
 */
export class BillingApiClient implements BillingService {
  private readonly baseUrl: string
  private readonly fetch: typeof globalThis.fetch
  private readonly maxAttempts: number
  private readonly paymentIntents = new Map<
    string,
    { key: string; cashAmount: Money; accountId: string }
  >()
  private readonly paymentOrderKeys = new Map<string, string>()

  constructor(private readonly options: BillingApiClientOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.xmcl.app').replace(/\/+$/, '')
    this.fetch = options.fetch ?? globalThis.fetch
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2)
  }

  getBalance() {
    return this.request('/v1/billing/balance', BillingBalanceSchema)
  }

  getRates() {
    return this.request('/v1/billing/rates', z.array(CashRateSchema))
  }

  getLedger(options: BillingPageOptions = {}) {
    return this.request(`/v1/billing/ledger${toPageQuery(options)}`, BillingLedgerPageSchema)
  }

  getUsage(options: BillingPageOptions = {}) {
    return this.request(`/v1/billing/usage${toPageQuery(options)}`, BillingUsagePageSchema)
  }

  getPaypalOrders(options: BillingPageOptions = {}) {
    return this.request(`/v1/billing/orders${toPageQuery(options)}`, PaypalOrderPageSchema)
  }

  async createPaypalOrder(intent: PaypalOrderIntent) {
    const parsed = PaypalOrderIntentSchema.parse(intent)
    const existing = this.paymentIntents.get(parsed.intentId)
    if (
      existing &&
      (existing.accountId !== parsed.accountId ||
        !sameMoney(existing.cashAmount, parsed.cashAmount))
    ) {
      throw new RangeError(
        'A payment intent cannot be reused with a different account or cash amount',
      )
    }
    const idempotencyKey = existing?.key ?? this.createIdempotencyKey()
    this.paymentIntents.set(parsed.intentId, {
      key: idempotencyKey,
      cashAmount: parsed.cashAmount,
      accountId: parsed.accountId,
    })
    const order = await this.request('/v1/billing/paypal/orders', PaypalOrderSchema, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ amountMinor: parsed.cashAmount.amountMinor }),
    })
    this.paymentOrderKeys.set(order.orderId, idempotencyKey)
    return order
  }

  async capturePaypalOrder(orderId: string): Promise<BillingPaymentStatus> {
    const id = encodeId(orderId)
    await this.request(`/v1/billing/paypal/orders/${id}/capture`, z.unknown(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': this.getPaymentOrderKey(orderId.trim()),
      },
      body: '{}',
    })
    return this.refreshPaypalOrder(orderId)
  }

  async refreshPaypalOrder(orderId: string): Promise<BillingPaymentStatus> {
    const id = encodeId(orderId)
    const [orders, balance] = await Promise.all([this.getPaypalOrders(), this.getBalance()])
    const order = orders.items.find((candidate) => candidate.orderId === id)
    if (!order) {
      throw new BillingApiError(
        404,
        'order_not_found',
        'The requested billing order was not returned by the server.',
        '',
        'api',
        false,
      )
    }
    return { order, balance }
  }

  private createIdempotencyKey(): string {
    const key = (this.options.createIdempotencyKey?.() ?? defaultIdempotencyKey()).trim()
    if (!key || key.length > 255) {
      throw new RangeError('Generated idempotencyKey must contain between 1 and 255 characters')
    }
    return key
  }

  private getPaymentOrderKey(orderId: string): string {
    const existing = this.paymentOrderKeys.get(orderId)
    if (existing) return existing
    const key = this.createIdempotencyKey()
    this.paymentOrderKeys.set(orderId, key)
    return key
  }

  private async request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const sessionToken = (await this.options.getSessionToken())?.trim()
    if (!sessionToken) {
      throw new BillingApiError(
        401,
        'session_required',
        'An XMCL session is required to access billing.',
        '',
        'permission',
        false,
      )
    }

    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Bearer ${sessionToken}`)

    let response: Response | undefined
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        response = await this.fetch(`${this.baseUrl}${path}`, { ...init, headers })
      } catch (cause) {
        if (attempt < this.maxAttempts) continue
        throw new BillingApiError(
          0,
          'network_error',
          'The XMCL billing API could not be reached.',
          '',
          'network',
          true,
          undefined,
          { cause },
        )
      }
      if (!isTransientStatus(response.status) || attempt === this.maxAttempts) break
    }

    if (!response) {
      throw new BillingApiError(
        0,
        'network_error',
        'The XMCL billing API could not be reached.',
        '',
        'network',
        true,
      )
    }
    const payload = await readJson(response)
    if (!response.ok) throw toBillingApiError(response.status, payload)

    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new BillingApiError(
        response.status,
        'invalid_api_response',
        'The XMCL billing API returned an invalid response.',
        response.headers.get('x-request-id') ?? '',
        'api',
        false,
        undefined,
        { cause: parsed.error },
      )
    }
    return parsed.data
  }
}

export function formatMoney(money: Money, locales?: Intl.LocalesArgument): string {
  const parsed = MoneySchema.parse(money)
  const formatter = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency: parsed.currency,
  })
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0
  return formatter.format(parsed.amountMinor / 10 ** fractionDigits)
}

export function classifyBillingError(status: number, errorCode: string): BillingErrorCategory {
  if (
    status === 401 ||
    status === 403 ||
    errorCode === 'session_required' ||
    errorCode === 'insufficient_scope' ||
    errorCode === 'permission_denied'
  ) {
    return 'permission'
  }
  if (errorCode.startsWith('payment_provider_') || errorCode.startsWith('paypal_'))
    return 'provider'
  if (
    status === 409 ||
    errorCode === 'usage_out_of_order' ||
    errorCode === 'usage_authorization_state_conflict'
  )
    return 'conflict'
  return 'api'
}

function toPageQuery(options: BillingPageOptions): string {
  const query = new URLSearchParams()
  if (options.cursor?.trim()) query.set('cursor', options.cursor.trim())
  if (options.limit !== undefined) {
    if (!Number.isSafeInteger(options.limit) || options.limit <= 0 || options.limit > 500) {
      throw new RangeError('limit must be a safe integer between 1 and 500')
    }
    query.set('limit', options.limit.toString())
  }
  return query.size === 0 ? '' : `?${query}`
}

function sameMoney(left: Money, right: Money): boolean {
  return left.currency === right.currency && left.amountMinor === right.amountMinor
}

function defaultIdempotencyKey(): string {
  return `billing-${globalThis.crypto.randomUUID()}`
}

function encodeId(value: string): string {
  const id = value.trim()
  if (!id) throw new RangeError('Resource id cannot be empty')
  return encodeURIComponent(id)
}

function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (cause) {
    throw new BillingApiError(
      response.status,
      'invalid_api_response',
      'The XMCL billing API returned an invalid response.',
      response.headers.get('x-request-id') ?? '',
      'api',
      false,
      undefined,
      { cause },
    )
  }
}

function toBillingApiError(status: number, payload: unknown): BillingApiError {
  const parsed = BillingApiErrorSchema.safeParse(payload)
  if (!parsed.success) {
    return new BillingApiError(
      status,
      'invalid_api_response',
      'The XMCL billing API returned an invalid error response.',
      '',
      'api',
      false,
      undefined,
      { cause: parsed.error },
    )
  }
  const body = parsed.data
  return new BillingApiError(
    status,
    body.error,
    body.message,
    body.requestId,
    classifyBillingError(status, body.error),
    isTransientStatus(status) || body.error === 'payment_provider_unavailable',
    sanitizeApiDetails(body.details),
  )
}

function sanitizeApiDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeApiDetails)
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (/(?:token|secret|authorization|api.?key|provider.?body|provider.?response)/i.test(key))
      continue
    result[key] = sanitizeApiDetails(child)
  }
  return result
}
