<template>
  <section
    data-testid="commercial-account-panel"
    class="commercial-account-panel surface-card-subsection"
    :aria-label="t('commercialAccount.title')"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <v-icon color="primary" aria-hidden="true">verified_user</v-icon>
          <h2 class="text-lg font-semibold">{{ t('commercialAccount.title') }}</h2>
        </div>
        <p class="mt-1 text-sm opacity-60">{{ t('commercialAccount.description') }}</p>
      </div>
      <v-chip :color="account ? accountStatusColor : undefined" size="small" variant="tonal">
        {{ account ? t(`commercialAccount.status.${account.status}`) : t('commercialAccount.guest') }}
      </v-chip>
    </div>

    <v-alert
      v-if="conflict"
      data-testid="commercial-account-conflict"
      type="warning"
      variant="tonal"
      class="mt-4"
    >
      {{ t('commercialAccount.identityConflict', { provider: providerName(conflict.provider) }) }}
      <template #append>
        <v-btn
          v-if="session"
          data-testid="commercial-account-merge-prepare"
          size="small"
          variant="tonal"
          :loading="busy"
          @click="prepareMerge"
        >
          {{ t('commercialAccount.reviewMerge') }}
        </v-btn>
        <span v-else class="text-xs">{{ t('commercialAccount.mergeNeedsSession') }}</span>
      </template>
    </v-alert>

    <v-alert
      v-if="mergePreview"
      data-testid="commercial-account-merge-preview"
      type="info"
      variant="tonal"
      class="mt-4"
    >
      <div class="font-medium">{{ t('commercialAccount.mergePreview') }}</div>
      <ul class="mt-2 text-sm">
        <li v-for="resource in mergePreview.resources" :key="resource.type">
          {{ resource.type }}<template v-if="resource.count !== undefined">: {{ resource.count }}</template>
        </li>
      </ul>
      <v-btn
        data-testid="commercial-account-merge-confirm"
        class="mt-3"
        size="small"
        color="primary"
        :loading="busy"
        @click="confirmMerge"
      >
        {{ t('commercialAccount.confirmMerge') }}
      </v-btn>
    </v-alert>

    <v-alert v-if="mergeTaskId" type="success" variant="tonal" class="mt-4">
      {{ t('commercialAccount.mergeQueued') }}
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
      {{ t('commercialAccount.requestFailed') }}
    </v-alert>

    <template v-if="account">
      <div class="commercial-account-grid mt-4">
        <div class="surface-card-row rounded-xl p-4">
          <div class="text-xs font-semibold uppercase tracking-wider opacity-50">
            {{ t('commercialAccount.accountSummary') }}
          </div>
          <div class="mt-2 font-mono text-sm break-all">{{ account.accountId }}</div>
          <div class="mt-1 text-xs opacity-60">
            {{ t('commercialAccount.createdAt', { date: formatDate(account.createdAt) }) }}
          </div>
        </div>

        <div class="surface-card-row rounded-xl p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ t('commercialAccount.session') }}
            </div>
            <v-chip :color="sessionExpired ? 'warning' : 'success'" size="x-small" variant="tonal">
              {{ sessionExpired ? t('commercialAccount.sessionExpired') : t('commercialAccount.sessionActive') }}
            </v-chip>
          </div>
          <div class="mt-2 text-sm">
            {{ session ? t('commercialAccount.expiresAt', { date: formatDate(session.expiresAt) }) : '—' }}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <v-btn
              data-testid="commercial-session-refresh"
              size="small"
              variant="tonal"
              :loading="busy"
              @click="refreshSession"
            >
              {{ t('shared.refresh') }}
            </v-btn>
            <v-btn
              data-testid="commercial-session-revoke"
              size="small"
              variant="text"
              :disabled="busy"
              @click="revokeSession(false)"
            >
              {{ t('commercialAccount.signOutDevice') }}
            </v-btn>
            <v-btn size="small" variant="text" :disabled="busy" @click="revokeSession(true)">
              {{ t('commercialAccount.signOutAll') }}
            </v-btn>
          </div>
        </div>
      </div>

    </template>

    <div class="mt-5">
      <div v-if="!account" class="text-sm font-semibold">{{ t('commercialAccount.linkAccountWith') }}</div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <v-btn
          data-testid="commercial-provider-microsoft"
          variant="tonal"
          :disabled="busy || isProviderLinked('microsoft')"
          @click="openMicrosoftLogin"
        >
          <v-icon start aria-hidden="true">{{ isProviderLinked('microsoft') ? 'check' : providerIcon('microsoft') }}</v-icon>
          Microsoft
        </v-btn>
        <v-btn
          data-testid="commercial-provider-modrinth"
          variant="tonal"
          :disabled="busy || isProviderLinked('modrinth')"
          @click="openModrinthLogin"
        >
          <v-icon start aria-hidden="true">{{ isProviderLinked('modrinth') ? 'check' : providerIcon('modrinth') }}</v-icon>
          Modrinth
        </v-btn>
        <v-btn
          data-testid="commercial-provider-google"
          variant="tonal"
          :disabled="busy || isProviderLinked('google')"
          :loading="busy && !isProviderLinked('google')"
          @click="authorizeProvider('google')"
        >
          <v-icon start aria-hidden="true">{{ isProviderLinked('google') ? 'check' : providerIcon('google') }}</v-icon>
          Google
        </v-btn>
        <v-btn
          data-testid="commercial-provider-discord"
          variant="tonal"
          :disabled="busy || isProviderLinked('discord')"
          :loading="busy && !isProviderLinked('discord')"
          @click="authorizeProvider('discord')"
        >
          <v-icon start aria-hidden="true">{{ isProviderLinked('discord') ? 'check' : providerIcon('discord') }}</v-icon>
          Discord
        </v-btn>
      </div>
      <p class="mt-3 text-xs opacity-60">{{ t('commercialAccount.gameAccountsSeparate') }}</p>
    </div>

  </section>
</template>

<script lang="ts" setup>
import { kCommercialAccount } from '@/composables/commercialAccount'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { useUserMenuControl } from '@/composables/userMenu'
import { injection } from '@/util/inject'
import type { CommercialAccountStatus, CommercialOAuthProvider } from '@xmcl/runtime-api'

const { t, locale } = useI18n()
const {
  account,
  identities,
  session,
  conflict,
  mergePreview,
  mergeTaskId,
  sessionExpired,
  busy,
  error,
  authorizeProvider,
  prepareMerge,
  confirmMerge,
  refreshSession,
  revokeSession,
} = injection(kCommercialAccount)
const modrinth = injection(kModrinthAuthenticatedAPI)
const { show: showUserProfileDialog } = useUserMenuControl()

const accountStatusColor = computed(() => {
  const colors: Record<CommercialAccountStatus, string> = {
    active: 'success',
    merged: 'info',
    deletion_pending: 'warning',
    deleted: 'error',
  }
  return account.value ? colors[account.value.status] : undefined
})

function providerName(provider: CommercialOAuthProvider) {
  return provider[0].toUpperCase() + provider.slice(1)
}

function providerIcon(provider: CommercialOAuthProvider) {
  if (provider === 'microsoft' || provider === 'modrinth') return `xmcl:${provider}`
  return provider === 'google' ? 'language' : 'forum'
}

function isProviderLinked(provider: CommercialOAuthProvider) {
  return identities.value.some(identity => identity.provider === provider)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function openMicrosoftLogin() {
  showUserProfileDialog('login')
}

function openModrinthLogin() {
  modrinth.interact()
}

</script>

<style scoped>
.commercial-account-panel {
  padding: 16px;
}

.commercial-account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .commercial-account-grid {
    grid-template-columns: 1fr;
  }
}
</style>
