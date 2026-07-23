import { describe, expect, test } from 'vitest'
import {
  assertSafeSupportContent,
  assertSafeSupportSubmission,
  SensitiveSupportContentError,
  SupportTicketSubmissionSchema,
} from './SupportService'
import { supportTicketFixtures } from './SupportService.fixtures'
import { SupportServiceMock } from './SupportService.mock'

describe('M7 SupportService local fixtures', () => {
  test('accepts the user-scoped refund, deletion, appeal, and feedback fixtures', () => {
    for (const fixture of Object.values(supportTicketFixtures).slice(0, -1)) {
      expect(SupportTicketSubmissionSchema.parse(fixture)).toEqual(fixture)
    }
  })

  test('rejects unauthenticated callers and server appeals outside the user permission boundary', async () => {
    const unauthenticated = new SupportServiceMock({ authenticated: false })
    await expect(unauthenticated.listTickets()).rejects.toMatchObject({
      code: 'unauthenticated',
    })

    const restricted = new SupportServiceMock({ allowedServerIds: [] })
    await expect(restricted.createTicket(supportTicketFixtures.serverAppeal)).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  test('preserves the idempotency key through duplicate delivery and rejects conflicting reuse', async () => {
    const service = new SupportServiceMock()
    const first = await service.createTicket(supportTicketFixtures.refundRequest)
    const duplicate = await service.createTicket(supportTicketFixtures.refundRequest)
    expect(duplicate).toMatchObject({ replayed: true, ticket: { ticketId: first.ticket.ticketId } })
    await expect(service.createTicket({
      ...supportTicketFixtures.refundRequest,
      subject: 'A different refund request',
    })).rejects.toMatchObject({ code: 'idempotency_conflict' })
  })

  test('leaves no ticket behind after a provider failure so the same request can retry', async () => {
    const service = new SupportServiceMock({ createFailures: ['provider_unavailable'] })
    await expect(service.createTicket(supportTicketFixtures.accountDeletion)).rejects.toMatchObject({
      code: 'provider_unavailable',
      retryable: true,
    })
    expect(await service.listTickets()).toEqual([])

    const retried = await service.createTicket(supportTicketFixtures.accountDeletion)
    expect(retried).toMatchObject({ replayed: false, ticket: { type: 'account_deletion' } })
  })

  test('ignores duplicate and out-of-order manual-handling updates', async () => {
    const service = new SupportServiceMock()
    const { ticket } = await service.createTicket(supportTicketFixtures.serverAppeal)
    const reviewed = service.applyTicketUpdate(ticket.ticketId, {
      status: 'in_review',
      statusVersion: 2,
      updatedAt: '2026-07-22T10:00:00.000Z',
    })
    const stale = service.applyTicketUpdate(ticket.ticketId, {
      status: 'submitted',
      statusVersion: 1,
      updatedAt: '2026-07-22T09:00:00.000Z',
    })
    const duplicate = service.applyTicketUpdate(ticket.ticketId, {
      status: 'waiting_for_user',
      statusVersion: 2,
      updatedAt: '2026-07-22T10:01:00.000Z',
    })

    expect(stale).toEqual(reviewed)
    expect(duplicate).toEqual(reviewed)
    expect((await service.listTickets())[0]).toEqual(reviewed)
  })

  test('blocks credentials and full payment details from support content', () => {
    expect(() => assertSafeSupportContent(supportTicketFixtures.sensitiveContent.description)).toThrow(SensitiveSupportContentError)
    expect(() => assertSafeSupportContent('card: 4111 1111 1111 1111')).toThrow(SensitiveSupportContentError)
  })

  test('checks every user-controlled submission field before creating a ticket', async () => {
    const sensitivePurchaseReference = {
      ...supportTicketFixtures.refundRequest,
      purchaseReference: 'card: 4111 1111 1111 1111',
    }
    const submissions = [
      { ...supportTicketFixtures.refundRequest, idempotencyKey: 'access_token: not-a-real-token' },
      { ...supportTicketFixtures.refundRequest, subject: 'cvv: 123' },
      { ...supportTicketFixtures.refundRequest, description: 'iban: GB82 WEST 1234 5698 7654 32' },
      sensitivePurchaseReference,
      { ...supportTicketFixtures.serverAppeal, serverId: 'access_token: not-a-real-token' },
      { ...supportTicketFixtures.errorFeedback, errorCode: 'card: 4111 1111 1111 1111' },
      { ...supportTicketFixtures.errorFeedback, launcherVersion: 'routing number: 123456789' },
    ]

    for (const submission of submissions) {
      expect(() => assertSafeSupportSubmission(submission)).toThrow(SensitiveSupportContentError)
    }
    await expect(new SupportServiceMock().createTicket(sensitivePurchaseReference)).rejects.toBeInstanceOf(SensitiveSupportContentError)
  })
})
