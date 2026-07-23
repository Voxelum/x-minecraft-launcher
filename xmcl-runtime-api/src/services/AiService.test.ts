import { describe, expect, test } from 'vitest'
import {
  AiApiErrorSchema,
  AiModelSchema,
  AiRequestSchema,
  AiResultSchema,
  AiUsagePageSchema,
} from './AiService'

describe('AiService schemas', () => {
  test('parses the public model, request, and result resources', () => {
    expect(AiModelSchema.parse({
      model: 'provider-neutral-small',
      capability: 'troubleshoot',
      usageResources: ['ai_request', 'ai_tokens'],
      rates: [
        {
          resource: 'ai_request',
          unit: 'request',
          rateVersion: 7,
          price: { currency: 'USD', amountMinor: 1 },
        },
      ],
    })).toBeTruthy()

    expect(AiRequestSchema.parse({
      capability: 'troubleshoot',
      input: 'The game exits before the window opens.',
      idempotencyKey: 'ai-test-001',
    })).toBeTruthy()

    expect(AiResultSchema.parse({
      requestId: 'air_test_001',
      providerRequestId: 'provider_test_001',
      output: 'Check the latest launcher log.',
      usage: [
        { resource: 'ai_request', quantity: 1, unit: 'request' },
        { resource: 'ai_tokens', quantity: 42, unit: 'token' },
      ],
    })).toBeTruthy()
  })

  test('parses server-confirmed usage charges and stable API errors', () => {
    expect(AiUsagePageSchema.parse({
      items: [{
        usageEventId: 'air_test_001:ai_tokens',
        requestId: 'air_test_001',
        occurredAt: '2026-07-22T10:02:00.000Z',
        rateVersion: 7,
        charged: { currency: 'USD', amountMinor: 4 },
        status: 'settled',
        usage: { resource: 'ai_tokens', quantity: 42, unit: 'token' },
      }],
    })).toBeTruthy()

    expect(AiApiErrorSchema.parse({
      error: 'insufficient_balance',
      message: 'Insufficient balance.',
      requestId: 'req_fixture_balance',
    })).toBeTruthy()
  })

  test('rejects provider secrets and client-authored prices', () => {
    expect(AiRequestSchema.safeParse({
      capability: 'troubleshoot',
      input: 'The game does not start.',
      idempotencyKey: 'ai-test-002',
      providerApiKey: 'secret',
    }).success).toBe(false)

    expect(AiResultSchema.safeParse({
      requestId: 'air_test_002',
      providerRequestId: 'provider_test_002',
      output: 'Check Java settings.',
      usage: [{ resource: 'ai_request', quantity: 1, unit: 'request' }],
      amountMinor: 5,
    }).success).toBe(false)
  })

  test('rejects mismatched usage units', () => {
    expect(AiResultSchema.safeParse({
      requestId: 'air_test_003',
      providerRequestId: 'provider_test_003',
      output: '',
      usage: [{ resource: 'ai_tokens', quantity: 1, unit: 'request' }],
    }).success).toBe(false)

    expect(AiUsagePageSchema.safeParse({
      items: [{
        usageEventId: 'air_test_003:ai_tokens',
        requestId: 'air_test_003',
        occurredAt: '2026-07-22T10:02:00.000Z',
        rateVersion: 7,
        charged: { currency: 'usd', amountMinor: 4 },
        status: 'settled',
        usage: { resource: 'ai_tokens', quantity: 1, unit: 'request' },
      }],
    }).success).toBe(false)

    const duplicate = {
      usageEventId: 'air_test_003:ai_request',
      requestId: 'air_test_003',
      occurredAt: '2026-07-22T10:02:00.000Z',
      rateVersion: 7,
      charged: { currency: 'USD', amountMinor: 1 },
      status: 'settled',
      usage: { resource: 'ai_request', quantity: 1, unit: 'request' },
    }
    expect(AiUsagePageSchema.safeParse({ items: [duplicate, duplicate] }).success).toBe(false)
  })
})