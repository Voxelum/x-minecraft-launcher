<template>
  <SettingCard>
    <!-- Language Selection -->
    <SettingItem :description="t('setting.languageDescription')">
      <template #title>
        <v-icon left small color="primary">language</v-icon>
        {{ t('setting.language') }}
      </template>
      <template #action>
        <v-select
          v-model="selectedLocale"
          :items="locales"
          outlined
          dense
          hide-details
          class="language-select"
        >
          <template #selection="{ item }">
            <span class="font-weight-medium">{{ item.text }}</span>
          </template>
        </v-select>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Data Directory -->
    <SettingItem :description="errorText || root" :title-class="`${errorText ? 'error--text' : ''}`" long-action>
      <template #title>
        <v-icon left small :color="errorText ? 'error' : 'primary'">folder</v-icon>
        {{ t("setting.location") }}
      </template>
      <template #action>
        <div class="flex gap-2 justify-end">
          <v-btn small outlined color="primary" @click="onMigrateFromOther">
            <v-icon left small>local_shipping</v-icon>
            {{ t("setting.migrateFromOther") }}
          </v-btn>
          <v-btn small outlined color="primary" @click="browseRootDir">
            <v-icon left small>edit</v-icon>
            {{ t("setting.browseRoot") }}
          </v-btn>
          <v-btn small outlined color="primary" @click="showGameDirectory()">
            <v-icon left small>folder_open</v-icon>
            {{ t("setting.showRoot") }}
          </v-btn>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Privacy & Telemetry -->
    <SettingItemSwitcher
      :value="disableTelemetry"
      @input="disableTelemetry = $event"
      :title="t('setting.disableTelemetry')"
      :description="t('setting.disableTelemetryDescription')"
      icon="privacy_tip"
    />

    <!-- GPU Optimization (Windows/Linux only) -->
    <template v-if="env?.os === 'linux' || env?.os === 'windows'">
      <v-divider class="my-3" />
      <SettingItemSwitcher
        :value="enableDedicatedGPUOptimization"
        @input="enableDedicatedGPUOptimization = $event"
        :title="t('setting.enableDedicatedGPUOptimization')"
        :description="t('setting.enableDedicatedGPUOptimizationDescription')"
        icon="memory"
      />
    </template>

    <!-- Discord Presence -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="enableDiscord"
      @input="enableDiscord = $event"
      :title="t('setting.enableDiscord')"
      :description="t('setting.enableDiscordDescription')"
      icon="discord"
    />

    <!-- Developer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="developerMode"
      @input="developerMode = $event"
      :title="t('setting.developerMode')"
      :description="t('setting.developerModeDescription')"
      icon="code"
    >
      <v-chip v-if="developerMode" x-small color="warning" class="ml-2">{{ t('setting.devModeLabel') }}</v-chip>
    </SettingItemSwitcher>

    <!-- Streamer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="streamerMode"
      @input="streamerMode = $event"
      :title="t('setting.streamerMode')"
      :description="t('setting.streamerModeDescription')"
      icon="videocam"
    />

    <!-- Spotlight Shortcut -->
    <v-divider class="my-3" />
    <SettingItem :description="t('setting.spotlightShortcutDescription')">
      <template #title>
        <v-icon left small color="primary">keyboard</v-icon>
        {{ t('setting.spotlightShortcut') }}
      </template>
      <template #action>
        <div class="flex gap-2 justify-end">
          <v-chip label color="primary" class="font-mono">
            <v-icon left x-small>mdi-keyboard</v-icon>
            {{ shortcutDisplay }}
          </v-chip>
          <v-btn 
            small 
            outlined 
            :color="isRecordingShortcut ? 'warning' : 'primary'" 
            @click="changeShortcut"
            :loading="isRecordingShortcut"
          >
            <v-icon left small>{{ isRecordingShortcut ? 'mdi-timer-sand' : 'mdi-pencil' }}</v-icon>
            {{ isRecordingShortcut ? t('setting.recordingShortcut') : t('setting.changeShortcut') }}
          </v-btn>
          <v-btn small text color="gray" @click="resetShortcut">
            <v-icon left small>mdi-refresh</v-icon>
            {{ t('setting.resetShortcut') }}
          </v-btn>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <SettingItem :description="t('setting.replaceNativeDescription')">
      <template #title>
        <v-icon left small color="primary">swap_horiz</v-icon>
        {{ t('setting.replaceNative') }}
      </template>
      <template #action>
        <v-select
          :value="replaceNative === false ? '' : replaceNative"
          :items="replaceNativeItems"
          outlined
          dense
          hide-details
          class="native-select"
          @change="replaceNative = !$event ? false : $event"
        />
      </template>
    </SettingItem>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { useGameDirectory, useSettings } from '../composables/setting'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import { useLocalStorage } from '@vueuse/core'

const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus)
const getDirErroText = useGetDataDirErrorText()
const errorText = computed(() => isNoEmptySpace.value ? t('errors.DiskIsFull') : invalidGameDataPath.value ? getDirErroText(invalidGameDataPath.value) : undefined)
const env = injection(kEnvironment)
const {
  streamerMode,
  developerMode,
  selectedLocale,
  replaceNative,
  disableTelemetry,
  enableDiscord,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings()
const { t } = useI18n()
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })))
const replaceNativeItems = computed(() => [
  {
    text: t('shared.disable'),
    value: '',
  },
  {
    text: t('setting.replaceNatives.legacy'),
    value: 'legacy-only',
  },
  {
    text: t('setting.replaceNatives.all'),
    value: 'all',
  },
])

// Spotlight shortcut settings
const spotlightShortcut = useLocalStorage('spotlight-shortcut', 'Ctrl+K')
const isRecordingShortcut = ref(false)

const shortcutDisplay = computed(() => {
  return spotlightShortcut.value
})

function changeShortcut() {
  isRecordingShortcut.value = true
  let currentKeys = new Set<string>()
  
  const handler = (e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Track all pressed keys
    if (e.ctrlKey) currentKeys.add('Ctrl')
    if (e.metaKey) currentKeys.add('Cmd')
    if (e.altKey) currentKeys.add('Alt')
    if (e.shiftKey) currentKeys.add('Shift')

    // Add the main key (non-modifier)
    if (e.key !== 'Control' && e.key !== 'Meta' && e.key !== 'Alt' && e.key !== 'Shift') {
      currentKeys.add(e.key.toUpperCase())
    }

    // Wait for key release to confirm
    const keyupHandler = (upEvent: KeyboardEvent) => {
      document.removeEventListener('keyup', keyupHandler)
      
      // Build the shortcut string
      const keys = Array.from(currentKeys)
      const modifiers: string[] = []
      let mainKey = ''
      
      // Separate modifiers from main key
      for (const key of keys) {
        if (['CTRL', 'CMD', 'META', 'ALT', 'SHIFT'].includes(key.toUpperCase())) {
          modifiers.push(key === 'CMD' ? 'Cmd' : key.charAt(0).toUpperCase() + key.slice(1).toLowerCase())
        } else {
          mainKey = key
        }
      }
      
      // Must have at least one modifier and one main key
      if (modifiers.length > 0 && mainKey) {
        spotlightShortcut.value = [...modifiers, mainKey].join('+')
      }
      
      currentKeys.clear()
      isRecordingShortcut.value = false
      document.removeEventListener('keydown', handler)
    }
    
    document.addEventListener('keyup', keyupHandler, { once: true })
  }

  document.addEventListener('keydown', handler, { once: false })
}

function resetShortcut() {
  spotlightShortcut.value = 'Ctrl+K'
}

const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')

</script>

<style scoped>
.settings-card {
  border-radius: 12px;
}

:deep(.transparent-list) {
  background: transparent !important;
}

.language-select,
.native-select {
  min-width: 200px;
  max-width: 300px;
}

.v-list-item {
  min-height: 64px;
}

.v-list-item__action {
  align-self: center;
}
</style>
