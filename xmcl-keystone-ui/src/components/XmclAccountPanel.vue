<template>
  <section
    data-testid="xmcl-account-panel"
    class="xmcl-account-panel surface-card-subsection rounded-xl"
    :aria-label="t('xmclAccount.title')"
  >
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm opacity-60">{{ t('xmclAccount.description') }}</p>
      <v-chip :color="account ? accountStatusColor : undefined" size="small" variant="tonal">
        {{ account ? t(`xmclAccount.status.${account.status}`) : t('xmclAccount.guest') }}
      </v-chip>
    </div>

    <v-alert
      v-if="!configured"
      data-testid="xmcl-account-unconfigured"
      type="info"
      variant="tonal"
      class="mt-4"
    >
      {{ t('xmclAccount.unconfigured') }}
    </v-alert>

    <v-alert
      v-if="conflictProvider"
      data-testid="xmcl-account-conflict"
      type="warning"
      variant="tonal"
      class="mt-4"
    >
      {{ t('xmclAccount.identityConflict', { provider: providerName(conflictProvider) }) }}
    </v-alert>
    <v-alert
      v-else-if="errorCode"
      data-testid="xmcl-account-error"
      type="error"
      variant="tonal"
      class="mt-4"
    >
      {{ errorMessage }}
      <div class="mt-1 text-xs opacity-60 font-mono">{{ errorCode }}</div>
    </v-alert>

    <template v-if="account">
      <div class="xmcl-account-grid mt-4">
        <div class="surface-card-row rounded-xl p-4">
          <div class="text-xs font-semibold uppercase tracking-wider opacity-50">
            {{ t('xmclAccount.accountSummary') }}
          </div>
          <div class="mt-2 font-mono text-sm break-all">{{ account.accountId }}</div>
          <div class="mt-1 text-xs opacity-60">
            {{ t('xmclAccount.createdAt', { date: formatDate(account.createdAt) }) }}
          </div>
        </div>

        <div class="surface-card-row rounded-xl p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ t('xmclAccount.session') }}
            </div>
            <v-chip :color="sessionExpired ? 'warning' : 'success'" size="x-small" variant="tonal">
              {{ sessionExpired ? t('xmclAccount.sessionExpired') : t('xmclAccount.sessionActive') }}
            </v-chip>
          </div>
          <div class="mt-2 text-sm">
            {{ session ? t('xmclAccount.expiresAt', { date: formatDate(session.expiresAt) }) : '—' }}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <v-btn
              data-testid="xmcl-session-refresh"
              size="small"
              variant="tonal"
              :loading="busy && pending === 'refresh'"
              :disabled="busy"
              @click="act('refresh', refreshSession)"
            >
              {{ t('shared.refresh') }}
            </v-btn>
            <v-btn
              data-testid="xmcl-session-revoke"
              size="small"
              variant="text"
              :disabled="busy"
              @click="act('signout', () => revokeSession(false))"
            >
              {{ t('xmclAccount.signOutDevice') }}
            </v-btn>
            <v-btn
              data-testid="xmcl-session-revoke-all"
              size="small"
              variant="text"
              :disabled="busy"
              @click="act('signout', () => revokeSession(true))"
            >
              {{ t('xmclAccount.signOutAll') }}
            </v-btn>
          </div>
        </div>
      </div>
    </template>

    <div class="mt-5">
      <div class="text-sm font-semibold tracking-wide opacity-80 mb-3">
        {{ account ? t('xmclAccount.signInMethods') : t('xmclAccount.signInWith') }}
      </div>
      <div data-testid="xmcl-account-identities" class="grid gap-3 sm:grid-cols-3">
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          :data-testid="`xmcl-provider-${provider.id}`"
          class="provider-btn"
          :class="[`provider-btn--${provider.id}`, { 'provider-btn--linked': !!identityOf(provider.id) }]"
          :disabled="!configured || busy || !!identityOf(provider.id)"
          :aria-label="identityOf(provider.id)
            ? t('xmclAccount.linkedAs', { provider: provider.name, name: identityOf(provider.id)?.displayName ?? provider.name })
            : (account ? t('xmclAccount.link', { provider: provider.name }) : t('xmclAccount.signInWithProvider', { provider: provider.name }))"
          @click="signIn(provider.id)"
        >
          <v-progress-circular
            v-if="busy && pending === provider.id"
            indeterminate
            size="18"
            width="2"
            color="primary"
          />
          <v-icon v-else size="20" aria-hidden="true">xmcl:{{ provider.id }}</v-icon>
          <span class="provider-text">
            <span class="provider-name">{{ provider.name }}</span>
            <span v-if="identityOf(provider.id)" class="provider-detail">
              {{ identityOf(provider.id)?.displayName ?? t('xmclAccount.linked') }}
            </span>
            <span v-else-if="account" class="provider-detail">{{ t('xmclAccount.linkAction') }}</span>
          </span>
          <v-icon v-if="identityOf(provider.id)" color="success" size="18" aria-hidden="true">
            check_circle
          </v-icon>
        </button>
      </div>
      <p class="mt-3 text-xs opacity-60">{{ t('xmclAccount.gameAccountsSeparate') }}</p>
    </div>

    <div v-if="account" class="mt-5 flex items-center justify-between gap-4 danger-row rounded-xl p-4">
      <div>
        <div class="text-sm font-semibold">{{ t('xmclAccount.deleteTitle') }}</div>
        <div class="text-xs opacity-60">{{ t('xmclAccount.deleteDescription') }}</div>
      </div>
      <v-btn
        data-testid="xmcl-account-delete"
        size="small"
        color="error"
        variant="tonal"
        :disabled="busy"
        @click="confirmingDelete = true"
      >
        {{ t('xmclAccount.deleteAction') }}
      </v-btn>
    </div>

    <v-dialog v-model="confirmingDelete" :width="440">
      <v-card data-testid="xmcl-account-delete-dialog" :title="t('xmclAccount.deleteConfirmTitle')">
        <v-card-text>{{ t('xmclAccount.deleteConfirmText') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmingDelete = false">{{ t('shared.cancel') }}</v-btn>
          <v-btn
            data-testid="xmcl-account-delete-confirm"
            color="error"
            variant="flat"
            :loading="busy && pending === 'delete'"
            @click="confirmDelete"
          >
            {{ t('xmclAccount.deleteAction') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script lang="ts" setup>
import { kXmclAccount } from '@/composables/xmclAccount'
import { kFlights } from '@/composables/flights'
import { injection } from '@/util/inject'
import { VARDRYNN_API_ORIGIN_FLIGHT, type XmclAccountStatus, type XmclOAuthProvider } from '@xmcl/runtime-api'

type Provider = Extract<XmclOAuthProvider, 'microsoft' | 'google' | 'discord'>

const { t, locale } = useI18n()
const {
  account,
  identities,
  session,
  conflict,
  sessionExpired,
  busy,
  error,
  authorizeMicrosoft,
  authorizeProvider,
  refreshSession,
  revokeSession,
  deleteAccount,
} = injection(kXmclAccount)
const flights = inject(kFlights, {})
const configured = computed(() => !!flights[VARDRYNN_API_ORIGIN_FLIGHT])

const providers: Array<{ id: Provider; name: string }> = [
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'google', name: 'Google' },
  { id: 'discord', name: 'Discord' },
]

const pending = ref<string>()
const confirmingDelete = ref(false)
const lastProvider = ref<Provider>()

async function act(name: string, action: () => Promise<void>) {
  pending.value = name
  try {
    await action()
  } finally {
    pending.value = undefined
  }
}

function signIn(provider: Provider) {
  lastProvider.value = provider
  return act(provider, () => provider === 'microsoft' ? authorizeMicrosoft() : authorizeProvider(provider))
}

async function confirmDelete() {
  await act('delete', deleteAccount)
  if (!error.value) confirmingDelete.value = false
}

const errorCode = computed(() => {
  const e = error.value as { code?: string; message?: string } | undefined
  if (!e) return undefined
  return e.code || e.message || 'xmcl_account_request_failed'
})

// The service reports a provider identity that belongs to another account as identity_conflict.
const conflictProvider = computed<XmclOAuthProvider | undefined>(() =>
  conflict.value?.provider ?? (errorCode.value === 'identity_conflict' ? lastProvider.value : undefined))

const errorMessage = computed(() => {
  switch (errorCode.value) {
    case 'vardrynn_service_unconfigured': return t('xmclAccount.unconfigured')
    case 'MicrosoftClientUnconfigured':
    case 'provider_unconfigured': return t('xmclAccount.providerUnconfigured')
    case 'authorization_timeout': return t('xmclAccount.timedOut')
    case 'interactive_microsoft_auth_not_supported': return t('xmclAccount.providerUnconfigured')
    default: return t('xmclAccount.requestFailed')
  }
})

const accountStatusColor = computed(() => {
  const colors: Record<XmclAccountStatus, string> = {
    active: 'success',
    merged: 'info',
    deletion_pending: 'warning',
    deleted: 'error',
  }
  return account.value ? colors[account.value.status] : undefined
})

function providerName(provider: XmclOAuthProvider) {
  return provider[0].toUpperCase() + provider.slice(1)
}

function identityOf(provider: Provider) {
  return identities.value.find((identity) => identity.provider === provider)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? '—'
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>

<style scoped>
.xmcl-account-panel {
  padding: 20px;
}

.xmcl-account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.provider-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 6px 14px;
  border-radius: 12px;
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  font-size: 0.875rem;
  transition: background-color 0.2s, border-color 0.2s;
  cursor: pointer;
  width: 100%;
  color: inherit;
  text-align: left;
}

.provider-btn:hover:not(:disabled) {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.provider-btn--microsoft:hover:not(:disabled) { border-color: rgba(0, 164, 239, 0.45); }
.provider-btn--google:hover:not(:disabled) { border-color: rgba(66, 133, 244, 0.45); }
.provider-btn--discord:hover:not(:disabled) { border-color: rgba(88, 101, 242, 0.45); }

.provider-btn:disabled {
  cursor: default;
}

.provider-btn:disabled:not(.provider-btn--linked) {
  opacity: 0.55;
}

.provider-btn--linked {
  background-color: rgba(76, 175, 80, 0.08);
  border-color: rgba(76, 175, 80, 0.3);
}

.provider-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-weight: 500;
}

.provider-detail {
  font-size: 0.75rem;
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danger-row {
  border: 1px solid rgba(var(--v-theme-error), 0.3);
}

@media (max-width: 900px) {
  .xmcl-account-grid {
    grid-template-columns: 1fr;
  }
}
</style>
