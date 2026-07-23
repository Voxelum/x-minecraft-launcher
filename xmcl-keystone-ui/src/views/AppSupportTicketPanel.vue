<template>
  <section
    data-testid="support-ticket-form"
    class="surface-panel flex flex-col gap-3 p-4"
    :aria-label="t('support.name')"
  >
    <div class="flex items-center gap-2">
      <v-icon size="18" color="primary">support_agent</v-icon>
      <span class="text-sm font-semibold opacity-80">{{ t('support.name') }}</span>
    </div>
    <div class="text-xs opacity-70">{{ t('support.sensitiveNotice') }}</div>

    <v-select
      v-model="type"
      :items="ticketTypes"
      :label="t('support.type')"
      density="compact"
      hide-details
      variant="outlined"
    />
    <v-text-field
      v-model="subject"
      :label="t('support.subject')"
      density="compact"
      hide-details
      variant="outlined"
    />
    <v-text-field
      v-if="type === 'refund_request'"
      v-model="purchaseReference"
      :label="t('support.purchaseReference')"
      density="compact"
      hide-details
      variant="outlined"
    />
    <v-text-field
      v-if="type === 'server_appeal'"
      v-model="serverId"
      :label="t('support.serverId')"
      density="compact"
      hide-details
      variant="outlined"
    />
    <v-text-field
      v-if="type === 'account_deletion'"
      v-model="deletionConfirmation"
      :label="t('support.deletionConfirmation')"
      density="compact"
      hide-details
      variant="outlined"
    />
    <v-textarea
      v-model="description"
      :label="t('support.description')"
      auto-grow
      density="compact"
      hide-details
      rows="2"
      variant="outlined"
    />
    <div v-if="error" class="text-xs text-error" role="alert">{{ t('support.submitFailed') }}</div>
    <v-btn
      data-testid="support-ticket-submit"
      color="primary"
      :disabled="!canSubmit"
      :loading="submitting"
      variant="flat"
      @click="submitTicket"
    >
      <v-icon start>send</v-icon>
      {{ t('support.submit') }}
    </v-btn>

    <div class="mt-2 text-sm font-semibold opacity-80">{{ t('support.myTickets') }}</div>
    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <div
      v-else
      data-testid="support-ticket-list"
      class="flex flex-col gap-2"
      :aria-label="t('support.myTickets')"
    >
      <div v-if="tickets.length === 0" class="text-xs opacity-70">{{ t('support.empty') }}</div>
      <div v-for="ticket in tickets" :key="ticket.ticketId" class="rounded bg-[rgba(var(--v-theme-on-surface),0.06)] p-2">
        <div class="text-sm">{{ ticket.subject }}</div>
        <div class="text-xs opacity-70">{{ statusLabel(ticket.status) }}</div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { SupportTicketStatus, SupportTicketSubmission, SupportTicketType } from '@xmcl/runtime-api'
import { computed, onMounted, ref } from 'vue'
import { useSupport } from '@/composables/support'

const { t } = useI18n()
const { tickets, loading, submitting, error, refresh, submit } = useSupport()
const type = ref<SupportTicketType>('error_feedback')
const subject = ref('')
const description = ref('')
const purchaseReference = ref('')
const serverId = ref('')
const deletionConfirmation = ref('')
const pendingRequest = ref<SupportTicketSubmission>()

const ticketTypes = computed(() => [
  { title: t('support.refundRequest'), value: 'refund_request' },
  { title: t('support.accountDeletion'), value: 'account_deletion' },
  { title: t('support.serverAppeal'), value: 'server_appeal' },
  { title: t('support.errorFeedback'), value: 'error_feedback' },
])

const canSubmit = computed(() => {
  if (!subject.value.trim() || !description.value.trim()) return false
  if (type.value === 'refund_request') return Boolean(purchaseReference.value.trim())
  if (type.value === 'server_appeal') return Boolean(serverId.value.trim())
  if (type.value === 'account_deletion') return deletionConfirmation.value === 'DELETE'
  return true
})

function idempotencyKey() {
  return `support-${crypto.randomUUID()}`
}

function statusLabel(status: SupportTicketStatus) {
  return t(`support.status.${status}`)
}

function request(): SupportTicketSubmission {
  const base = {
    idempotencyKey: idempotencyKey(),
    subject: subject.value,
    description: description.value,
  }
  switch (type.value) {
    case 'refund_request':
      return { ...base, type: 'refund_request', purchaseReference: purchaseReference.value }
    case 'account_deletion':
      return { ...base, type: 'account_deletion', confirmation: 'DELETE' }
    case 'server_appeal':
      return { ...base, type: 'server_appeal', serverId: serverId.value }
    case 'error_feedback':
      return { ...base, type: 'error_feedback' }
  }
}

async function submitTicket() {
  const submission = pendingRequest.value ?? request()
  try {
    await submit(submission)
    pendingRequest.value = undefined
    subject.value = ''
    description.value = ''
    purchaseReference.value = ''
    serverId.value = ''
    deletionConfirmation.value = ''
  } catch {
    pendingRequest.value = submission
  }
}

onMounted(() => {
  refresh().catch(() => undefined)
})
</script>
