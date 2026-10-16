<template>
  <div class="bp-subpage">
    <div class="bp-subpage-card">
      <div class="bp-subpage-header">
        <v-icon color="primary">tv</v-icon>
        <span>{{ t('bigPicture.title') }}</span>
      </div>

      <!-- Launch by default -->
      <div
        class="bp-setting-row"
        tabindex="0"
        role="checkbox"
        :aria-checked="defaultLaunch"
        @click="defaultLaunch = !defaultLaunch"
        @keydown.enter.prevent="defaultLaunch = !defaultLaunch"
        @keydown.space.prevent="defaultLaunch = !defaultLaunch"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title">{{ t('bigPicture.launchByDefault') }}</div>
          <div class="bp-setting-desc">{{ t('bigPicture.launchByDefaultHint') }}</div>
        </div>
        <v-switch
          v-model="defaultLaunch"
          color="primary"
          hide-details
          density="comfortable"
          inset
          @click.stop
        />
      </div>

      <!-- Auto on Gamepad -->
      <div
        class="bp-setting-row"
        tabindex="0"
        role="checkbox"
        :aria-checked="autoOnGamepad"
        @click="autoOnGamepad = !autoOnGamepad"
        @keydown.enter.prevent="autoOnGamepad = !autoOnGamepad"
        @keydown.space.prevent="autoOnGamepad = !autoOnGamepad"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title">{{ t('bigPicture.autoOnGamepad') }}</div>
          <div class="bp-setting-desc">{{ t('bigPicture.autoOnGamepadHint') }}</div>
        </div>
        <v-switch
          v-model="autoOnGamepad"
          color="primary"
          hide-details
          density="comfortable"
          inset
          @click.stop
        />
      </div>

      <!-- Switch to Desktop Mode -->
      <div
        class="bp-setting-row mt-4"
        tabindex="0"
        role="button"
        @click="exitBigPicture"
        @keydown.enter.prevent="exitBigPicture"
        @keydown.space.prevent="exitBigPicture"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title flex items-center gap-2">
            <v-icon size="small" color="primary">desktop_windows</v-icon>
            {{ t('bigPicture.desktopMode') }}
          </div>
          <div class="bp-setting-desc">{{ t('bigPicture.exit') }}</div>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          class="rounded-lg"
          @click.stop="exitBigPicture"
        >
          {{ t('bigPicture.exit') }}
        </v-btn>
      </div>
    </div>

    <div class="bp-subpage-card">
      <div class="bp-subpage-header">
        <v-icon color="primary">sports_esports</v-icon>
        <span>{{ t('gamepad.guideTitle') }}</span>
      </div>

      <!-- Gamepad Enable -->
      <div
        class="bp-setting-row"
        tabindex="0"
        role="checkbox"
        :aria-checked="gamepadEnabled"
        @click="gamepadEnabled = !gamepadEnabled"
        @keydown.enter.prevent="gamepadEnabled = !gamepadEnabled"
        @keydown.space.prevent="gamepadEnabled = !gamepadEnabled"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title">{{ t('gamepad.enableSwitchLabel') }}</div>
          <div class="bp-setting-desc">{{ gamepadConnected ? (gamepadName || t('gamepad.connected')) : t('bigPicture.noController') }}</div>
        </div>
        <v-switch
          v-model="gamepadEnabled"
          color="primary"
          hide-details
          density="comfortable"
          inset
          @click.stop
        />
      </div>

      <!-- Steam Keyboard -->
      <div
        class="bp-setting-row"
        tabindex="0"
        role="checkbox"
        :aria-checked="autoOpenKeyboard"
        @click="autoOpenKeyboard = !autoOpenKeyboard"
        @keydown.enter.prevent="autoOpenKeyboard = !autoOpenKeyboard"
        @keydown.space.prevent="autoOpenKeyboard = !autoOpenKeyboard"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title">{{ t('gamepad.autoOpenKeyboardLabel') }}</div>
          <div class="bp-setting-desc">{{ t('gamepad.autoOpenKeyboardHint') }}</div>
        </div>
        <v-switch
          v-model="autoOpenKeyboard"
          color="primary"
          hide-details
          density="comfortable"
          inset
          @click.stop
        />
      </div>

      <!-- Vibration test -->
      <div
        class="bp-setting-row"
        tabindex="0"
        role="button"
        @click="onTestVibration"
        @keydown.enter.prevent="onTestVibration"
        @keydown.space.prevent="onTestVibration"
      >
        <div class="bp-setting-info">
          <div class="bp-setting-title flex items-center gap-2">
            <v-icon size="small" color="primary">vibration</v-icon>
            {{ t('bigPicture.testRumble') }}
          </div>
          <div class="bp-setting-desc">{{ t('bigPicture.testRumbleSuccess') }}</div>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          class="rounded-lg"
          @click.stop="onTestVibration"
        >
          <v-icon start size="small">vibration</v-icon>
          {{ t('bigPicture.testRumble') }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBigPicture } from '@/composables/bigPicture'
import { useGamepad, vibrateGamepad } from '@/composables/gamepad'

const { t } = useI18n()
const { defaultLaunch, autoOnGamepad, exitBigPicture } = useBigPicture()
const gamepad = useGamepad()

const gamepadEnabled = gamepad.enabled
const gamepadConnected = gamepad.connected
const gamepadName = gamepad.name
const autoOpenKeyboard = gamepad.autoOpenKeyboard

function onTestVibration() {
  vibrateGamepad({ duration: 300, strongMagnitude: 0.8, weakMagnitude: 0.6 })
}
</script>
