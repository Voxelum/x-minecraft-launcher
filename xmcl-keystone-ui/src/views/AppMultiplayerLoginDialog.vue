<template>
  <v-dialog
    :model-value="isShown"
    :width="520"
    @update:model-value="onModelUpdate"
  >
    <v-card class="rounded-xl border border-white/10">
      <v-card-title class="flex items-center gap-3 pr-3 pt-5 px-6">
        <v-icon color="primary" size="26">hub</v-icon>
        <span class="flex-grow font-semibold text-lg">{{ t('multiplayer.loginRequiredTitle') }}</span>
        <v-btn
          :aria-label="t('shared.close')"
          icon="close"
          variant="text"
          density="comfortable"
          @click="cancel"
        />
      </v-card-title>
      <v-card-text class="px-6 pb-6 pt-2">
        <p class="mb-5 text-sm opacity-70 leading-relaxed">
          {{ t('multiplayer.loginRequiredDescription') }}
        </p>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ t('xmclAccount.requestFailed') }}
        </v-alert>
        <div class="grid grid-cols-2 gap-3">
          <!-- Microsoft -->
          <button
            type="button"
            class="provider-btn provider-btn--microsoft"
            :disabled="busy"
            @click="openMicrosoftLogin"
          >
            <v-icon size="20" aria-hidden="true" class="provider-icon">
              xmcl:microsoft
            </v-icon>
            <span class="provider-name">Microsoft</span>
          </button>

          <!-- Modrinth -->
          <button
            type="button"
            class="provider-btn provider-btn--modrinth"
            :disabled="busy"
            @click="openModrinthLogin"
          >
            <v-icon size="20" aria-hidden="true" class="provider-icon">
              xmcl:modrinth
            </v-icon>
            <span class="provider-name">Modrinth</span>
          </button>

          <!-- Google -->
          <button
            type="button"
            class="provider-btn provider-btn--google"
            :disabled="busy"
            @click="loginWithBrowser('google')"
          >
            <v-progress-circular
              v-if="busy"
              indeterminate
              size="18"
              width="2"
              color="primary"
            />
            <v-icon v-else size="20" aria-hidden="true" class="provider-icon">
              xmcl:google
            </v-icon>
            <span class="provider-name">Google</span>
          </button>

          <!-- Discord -->
          <button
            type="button"
            class="provider-btn provider-btn--discord"
            :disabled="busy"
            @click="loginWithBrowser('discord')"
          >
            <v-progress-circular
              v-if="busy"
              indeterminate
              size="18"
              width="2"
              color="primary"
            />
            <v-icon v-else size="20" aria-hidden="true" class="provider-icon">
              xmcl:discord
            </v-icon>
            <span class="provider-name">Discord</span>
          </button>
        </div>
        <p class="mt-5 text-xs opacity-50 text-center">
          {{ t('xmclAccount.gameAccountsSeparate') }}
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { kMultiplayerEntry } from '@/composables/multiplayerEntry'
import { useUserMenuControl } from '@/composables/userMenu'
import { injection } from '@/util/inject'
import type { XmclOAuthProvider } from '@xmcl/runtime-api'

const { t } = useI18n()
const { account, busy, error, isShown, authorizeProvider, cancel, handoff } =
  injection(kMultiplayerEntry)
const modrinth = injection(kModrinthAuthenticatedAPI)
const { showAndWait: showUserProfileDialogAndWait } = useUserMenuControl()

function onModelUpdate(value: boolean) {
  if (!value) cancel()
}

function openMicrosoftLogin() {
  void handoff(() => showUserProfileDialogAndWait('login'))
}

function openModrinthLogin() {
  void handoff(() => modrinth.interact())
}

function loginWithBrowser(provider: Extract<XmclOAuthProvider, 'google' | 'discord'>) {
  if (!account.value) void authorizeProvider(provider)
}
</script>

<style scoped>
.provider-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
  width: 100%;
  color: inherit;
}

.provider-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.provider-btn--microsoft:hover:not(:disabled) {
  border-color: rgba(0, 164, 239, 0.45);
}

.provider-btn--modrinth:hover:not(:disabled) {
  border-color: rgba(93, 164, 38, 0.45);
}

.provider-btn--google:hover:not(:disabled) {
  border-color: rgba(66, 133, 244, 0.45);
}

.provider-btn--discord:hover:not(:disabled) {
  border-color: rgba(88, 101, 242, 0.45);
}

.provider-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>