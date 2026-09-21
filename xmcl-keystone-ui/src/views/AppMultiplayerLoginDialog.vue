<template>
  <v-dialog
    :model-value="isShown"
    :width="540"
    transition="dialog-transition"
    @update:model-value="onModelUpdate"
  >
    <v-card
      data-testid="p2p-login-dialog"
      class="p2p-login-dialog relative overflow-hidden"
    >
      <!-- Ambient background decoration -->
      <div class="ambient-glow pointer-events-none" />

      <!-- Dialog Header -->
      <div class="relative z-1 px-7 pt-7 pb-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="icon-badge flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 p-3 shadow-lg shadow-emerald-950/40">
              <v-icon size="26">hub</v-icon>
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight leading-snug">
                {{ t('multiplayer.loginRequiredTitle') }}
              </h2>
            </div>
          </div>

          <v-btn
            data-testid="p2p-login-close-button"
            :aria-label="t('shared.close')"
            icon="close"
            variant="text"
            density="comfortable"
            class="opacity-60 hover:opacity-100 transition-opacity"
            @click="cancel"
          />
        </div>

        <p class="mt-4 text-sm opacity-70 leading-relaxed">
          {{ t('multiplayer.loginRequiredDescription') }}
        </p>
      </div>

      <!-- Dialog Body -->
      <v-card-text class="relative z-1 px-7 pt-3 pb-7">
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4 rounded-xl"
          density="comfortable"
        >
          {{ t('xmclAccount.requestFailed') }}
        </v-alert>

        <!-- Provider Buttons Grid -->
        <div class="grid grid-cols-2 gap-3.5 my-2">
          <!-- Microsoft -->
          <button
            type="button"
            data-testid="p2p-login-provider-microsoft"
            class="provider-btn provider-btn--microsoft"
            :disabled="busy"
            @click="openMicrosoftLogin"
          >
            <v-progress-circular
              v-if="busy && activeProvider === 'microsoft'"
              indeterminate
              size="20"
              width="2"
              color="primary"
            />
            <template v-else>
              <v-icon size="22" aria-hidden="true" class="provider-icon">
                xmcl:microsoft
              </v-icon>
              <span class="provider-name">Microsoft</span>
            </template>
          </button>

          <!-- Modrinth -->
          <button
            type="button"
            data-testid="p2p-login-provider-modrinth"
            class="provider-btn provider-btn--modrinth"
            :disabled="busy"
            @click="openModrinthLogin"
          >
            <v-progress-circular
              v-if="busy && activeProvider === 'modrinth'"
              indeterminate
              size="20"
              width="2"
              color="primary"
            />
            <template v-else>
              <v-icon size="22" aria-hidden="true" class="provider-icon">
                xmcl:modrinth
              </v-icon>
              <span class="provider-name">Modrinth</span>
            </template>
          </button>

          <!-- Google -->
          <button
            type="button"
            data-testid="p2p-login-provider-google"
            class="provider-btn provider-btn--google"
            :disabled="busy"
            @click="loginWithBrowser('google')"
          >
            <v-progress-circular
              v-if="busy && activeProvider === 'google'"
              indeterminate
              size="20"
              width="2"
              color="primary"
            />
            <template v-else>
              <v-icon size="22" aria-hidden="true" class="provider-icon">
                xmcl:google
              </v-icon>
              <span class="provider-name">Google</span>
            </template>
          </button>

          <!-- Discord -->
          <button
            type="button"
            data-testid="p2p-login-provider-discord"
            class="provider-btn provider-btn--discord"
            :disabled="busy"
            @click="loginWithBrowser('discord')"
          >
            <v-progress-circular
              v-if="busy && activeProvider === 'discord'"
              indeterminate
              size="20"
              width="2"
              color="primary"
            />
            <template v-else>
              <v-icon size="22" aria-hidden="true" class="provider-icon">
                xmcl:discord
              </v-icon>
              <span class="provider-name">Discord</span>
            </template>
          </button>
        </div>

        <!-- Security / Account separation note -->
        <div class="mt-5 flex items-start gap-2.5 rounded-xl surface-card-row p-3 text-xs opacity-75">
          <v-icon size="16" color="primary" class="mt-0.5 shrink-0">verified_user</v-icon>
          <span class="leading-relaxed">
            {{ t('xmclAccount.gameAccountsSeparate') }}
          </span>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { kMultiplayerEntry } from '@/composables/multiplayerEntry'
import { kXmclAccount } from '@/composables/xmclAccount'
import { injection } from '@/util/inject'
import type { XmclOAuthProvider } from '@xmcl/runtime-api'

const { t } = useI18n()
const { account, busy, error, isShown, cancel } =
  injection(kMultiplayerEntry)
const { authorizeMicrosoft, authorizeModrinth, authorizeProvider } = injection(kXmclAccount)
const { authenticate: authenticateModrinth } = injection(kModrinthAuthenticatedAPI)

const activeProvider = ref<string | null>(null)

function onModelUpdate(value: boolean) {
  if (!value) cancel()
}

async function openMicrosoftLogin() {
  activeProvider.value = 'microsoft'
  try {
    await authorizeMicrosoft()
  } finally {
    activeProvider.value = null
  }
}

async function openModrinthLogin() {
  activeProvider.value = 'modrinth'
  try {
    await authenticateModrinth()
    await authorizeModrinth()
  } finally {
    activeProvider.value = null
  }
}

async function loginWithBrowser(provider: Extract<XmclOAuthProvider, 'google' | 'discord'>) {
  if (!account.value) {
    activeProvider.value = provider
    try {
      await authorizeProvider(provider)
    } finally {
      activeProvider.value = null
    }
  }
}
</script>

<style scoped>
.p2p-login-dialog {
  background: rgba(var(--v-theme-surface), 0.92) !important;
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12) !important;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5) !important;
  border-radius: 24px !important;
}

.ambient-glow {
  position: absolute;
  top: -80px;
  left: 20%;
  width: 260px;
  height: 200px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.08) 50%, transparent 70%);
  filter: blur(40px);
}

.icon-badge {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
}

.icon-badge:hover {
  transform: scale(1.06) rotate(-3deg);
}

.provider-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  font-weight: 600;
  font-size: 0.925rem;
  letter-spacing: -0.01em;
  color: rgb(var(--v-theme-on-surface));
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.provider-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(circle at center, rgba(var(--v-theme-on-surface), 0.08) 0%, transparent 70%);
  transition: opacity 0.25s ease;
}

.provider-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.provider-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.provider-btn:active:not(:disabled) {
  transform: translateY(0);
}

.provider-btn--microsoft:hover:not(:disabled) {
  background: rgba(0, 164, 239, 0.1);
  border-color: rgba(0, 164, 239, 0.55);
  box-shadow: 0 8px 20px -4px rgba(0, 164, 239, 0.25);
}

.provider-btn--modrinth:hover:not(:disabled) {
  background: rgba(27, 217, 106, 0.1);
  border-color: rgba(27, 217, 106, 0.55);
  box-shadow: 0 8px 20px -4px rgba(27, 217, 106, 0.25);
}

.provider-btn--google:hover:not(:disabled) {
  background: rgba(66, 133, 244, 0.1);
  border-color: rgba(66, 133, 244, 0.55);
  box-shadow: 0 8px 20px -4px rgba(66, 133, 244, 0.25);
}

.provider-btn--discord:hover:not(:disabled) {
  background: rgba(88, 101, 242, 0.1);
  border-color: rgba(88, 101, 242, 0.55);
  box-shadow: 0 8px 20px -4px rgba(88, 101, 242, 0.25);
}

.provider-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}
</style>