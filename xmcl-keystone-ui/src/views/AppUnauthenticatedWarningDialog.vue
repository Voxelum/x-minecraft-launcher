<template>
  <v-dialog
    v-model="isShown"
    :width="520"
    :persistent="true"
    transition="fade-transition"
  >
    <v-card class="relative select-none">
      <v-btn
        v-shared-tooltip="() => t('unauthenticatedWarning.cancel')"
        icon="close"
        variant="text"
        density="comfortable"
        size="small"
        class="absolute right-3 top-3 z-1"
        @click="onCancel"
      />
      <div class="flex flex-col items-center px-8 pb-4 pt-10 text-center">
        <v-avatar
          color="warning"
          variant="tonal"
          size="72"
          rounded="xl"
          class="mb-6"
        >
          <v-icon size="36" color="warning">
            warning
          </v-icon>
        </v-avatar>
        <h3 class="mb-3 text-xl font-bold">
          {{ t('unauthenticatedWarning.title') }}
        </h3>
        <p class="max-w-prose text-sm opacity-70 leading-relaxed">
          {{ t('unauthenticatedWarning.description') }}
        </p>
      </div>

      <v-divider class="opacity-50" />

      <v-card-actions class="px-6 pb-6 pt-4">
        <v-btn
          v-shared-tooltip="() => 'Discord'"
          icon
          variant="text"
          @click="openDiscord"
        >
          <v-icon>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="() => 'GitHub'"
          icon
          variant="text"
          @click="openGithub"
        >
          <v-icon>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </v-icon>
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          rounded="pill"
          @click="onLogin"
        >
          {{ t('unauthenticatedWarning.login') }}
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          rounded="pill"
          @click="onPlay"
        >
          {{ t('unauthenticatedWarning.playAnyway') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export const AppUnauthenticatedWarningDialogKey = 'unauthenticated-warning'

export interface UnauthenticatedWarningParameter {
  /**
   * Invoked when the user picks "Play Anyway". The launch flow proceeds.
   */
  onPlay?: () => void
  /**
   * Invoked when the user cancels. The launch flow is aborted.
   */
  onCancel?: () => void
}
</script>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { kLaunchButton } from '@/composables/launchButton'
import { kUserContext } from '@/composables/user'
import { useUserMenuControl } from '@/composables/userMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { isShown, hide, show, parameter } = useDialog<UnauthenticatedWarningParameter>(
  AppUnauthenticatedWarningDialogKey,
)
const userMenu = useUserMenuControl()
const { users } = injection(kUserContext)
const { usePreclickListener } = injection(kLaunchButton)

// Intercept the launch flow when no account is signed in. Rejecting from the
// preclick listener cancels the launch chain (the launch button swallows the
// rejection); resolving lets it continue (used when the user picks "Play
// Anyway").
usePreclickListener(() => {
  if (users.value.length > 0) return
  return new Promise<void>((resolve, reject) => {
    show({
      onPlay: resolve,
      onCancel: () => reject(new Error('UnauthenticatedLaunchCancelled')),
    })
  })
})

const onPlay = () => {
  parameter.value?.onPlay?.()
  hide()
}

const onCancel = () => {
  parameter.value?.onCancel?.()
  hide()
}

const onLogin = () => {
  parameter.value?.onCancel?.()
  hide()
  userMenu.show('login')
}

const openDiscord = () => window.open('https://discord.gg/W5XVwYY7GQ', 'browser')
const openGithub = () => window.open('https://github.com/Voxelum/x-minecraft-launcher', 'browser')
</script>
