import {
  assertSafeSupportSubmission,
  SupportServiceKey,
  SupportTicketSubmissionSchema,
  type SupportTicket,
  type SupportTicketCreateResult,
  type SupportTicketSubmission,
} from '@xmcl/runtime-api'
import { ref } from 'vue'
import { useService } from './service'

function sortTickets(tickets: SupportTicket[]) {
  return [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function upsertTicket(tickets: SupportTicket[], ticket: SupportTicket) {
  const index = tickets.findIndex(current => current.ticketId === ticket.ticketId)
  if (index === -1) return sortTickets([...tickets, ticket])
  if (tickets[index].statusVersion > ticket.statusVersion) return tickets
  const next = [...tickets]
  next[index] = ticket
  return sortTickets(next)
}

/**
 * User-only M7 support state. It never accesses admin audit, reconciliation,
 * refund, balance-adjustment, stop, or resume endpoints.
 */
export function useSupport() {
  const service = useService(SupportServiceKey)
  const tickets = ref<SupportTicket[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<unknown>()

  async function refresh() {
    loading.value = true
    error.value = undefined
    try {
      tickets.value = sortTickets(await service.listTickets())
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  async function submit(input: SupportTicketSubmission): Promise<SupportTicketCreateResult> {
    const request = SupportTicketSubmissionSchema.parse(input)
    assertSafeSupportSubmission(request)
    submitting.value = true
    error.value = undefined
    try {
      const result = await service.createTicket(request)
      tickets.value = upsertTicket(tickets.value, result.ticket)
      return result
    } catch (e) {
      error.value = e
      throw e
    } finally {
      submitting.value = false
    }
  }

  return { tickets, loading, submitting, error, refresh, submit }
}
