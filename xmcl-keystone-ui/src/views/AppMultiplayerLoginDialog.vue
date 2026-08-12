<template>
  <v-dialog
    :model-value="isShown"
    :width="520"
    @update:model-value="onModelUpdate"
  >
    <v-card>
      <v-card-title class="flex items-center gap-3 pr-2">
        <v-icon color="primary">hub</v-icon>
        <span class="flex-grow">{{ t('multiplayer.loginRequiredTitle') }}</span>
        <v-btn
          :aria-label="t('shared.close')"
          icon="close"
          variant="text"
          @click="cancel"
        />
      </v-card-title>
      <v-card-text>
        <p class="mb-5 opacity-70">
          {{ t('multiplayer.loginRequiredDescription') }}
        </p>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ t('xmclAccount.requestFailed') }}
        </v-alert>
        <div class="grid grid-cols-2 gap-3">
          <v-btn variant="tonal" :disabled="busy" @click="openMicrosoftLogin">
            <v-icon start>xmcl:microsoft</v-icon>
            Microsoft
          </v-btn>
          <v-btn variant="tonal" :disabled="busy" @click="openModrinthLogin">
            <v-icon start>xmcl:modrinth</v-icon>
            Modrinth
          </v-btn>
          <v-btn
            variant="tonal"
            :disabled="busy"
            :loading="busy"
            @click="loginWithBrowser('google')"
          >
            <v-icon start>language</v-icon>
            Google
          </v-btn>
          <v-btn
            variant="tonal"
            :disabled="busy"
            :loading="busy"
            @click="loginWithBrowser('discord')"
          >
            <v-icon start>forum</v-icon>
            Discord
          </v-btn>
        </div>
        <p class="mt-4 text-xs opacity-60">
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