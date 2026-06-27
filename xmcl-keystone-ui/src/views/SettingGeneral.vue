<template>
  <SettingCard>
    <!-- Language Selection -->
    <SettingItemSelect
      v-model="selectedLocale"
      icon="language"
      :title="t('setting.language')"
      :description="t('setting.languageDescription')"
      :items="locales"
    />

    <v-divider class="my-3" />

    <!-- Data Directory -->
    <SettingItem :description="errorText || root" :title-class="`${errorText ? 'error--text' : ''}`" long-action>
      <template #title>
        <v-icon start size="small" :color="errorText ? 'error' : 'primary'">folder</v-icon>
        {{ t("setting.location") }}
      </template>
      <template #action>
        <div class="flex gap-2 justify-end">
          <v-btn color="primary" @click="onMigrateFromOther">
            <v-icon start size="small">local_shipping</v-icon>
            {{ t("setting.migrateFromOther") }}
          </v-btn>
          <v-btn color="primary" @click="browseRootDir">
            <v-icon start size="small">edit</v-icon>
            {{ t("setting.browseRoot") }}
          </v-btn>
          <v-btn color="primary" @click="showGameDirectory()">
            <v-icon start size="small">folder_open</v-icon>
            {{ t("setting.showRoot") }}
          </v-btn>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Privacy & Telemetry -->
    <SettingItemSwitcher
      v-model="disableTelemetry"
      :title="t('setting.disableTelemetry')"
      :description="t('setting.disableTelemetryDescription')"
      icon="privacy_tip"
    />

    <!-- GPU Optimization (Windows/Linux only) -->
    <template v-if="env?.os === 'linux' || env?.os === 'windows'">
      <v-divider class="my-3" />
      <SettingItemSwitcher
        v-model="enableDedicatedGPUOptimization"
        :title="t('setting.enableDedicatedGPUOptimization')"
        :description="t('setting.enableDedicatedGPUOptimizationDescription')"
        icon="memory"
      />
    </template>

    <!-- Discord Presence -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      v-model="enableDiscord"
      :title="t('setting.enableDiscord')"
      :description="t('setting.enableDiscordDescription')"
      icon="discord"
    />

    <!-- Developer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      v-model="developerMode"
      :title="t('setting.developerMode')"
      :description="t('setting.developerModeDescription')"
      icon="code"
    >
      <v-chip v-if="developerMode" size="x-small" color="warning" class="ml-2">{{ t('setting.devModeLabel') }}</v-chip>
    </SettingItemSwitcher>

    <!-- Streamer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      v-model="streamerMode"
      :title="t('setting.streamerMode')"
      :description="t('setting.streamerModeDescription')"
      icon="videocam"
    />

    <v-divider class="my-3" />

    <SettingItemSelect
      :model-value="replaceNative === false ? '' : replaceNative"
      icon="swap_horiz"
      :title="t('setting.replaceNative')"
      :description="t('setting.replaceNativeDescription')"
      :items="replaceNativeItems"
      @update:model-value="replaceNative = !$event ? false : $event"
    />

    <template v-if="developerMode">
      <v-divider class="my-3" />
      <SettingItem :title="t('setting.aiAgentApiKey')" :description="t('setting.aiAgentApiKeyDescription')">
        <template #title>
          <v-icon start size="small" color="primary">key</v-icon>
          {{ t('setting.aiAgentApiKey') }}
        </template>
        <template #action>
          <v-text-field
            :model-value="agentApiKey"
            :type="showAgentApiKey ? 'text' : 'password'"
            variant="outlined"
            density="compact"
            class="setting-item-input"
            hide-details
            clearable
            @update:model-value="agentApiKey = $event ?? ''"
          >
            <template #append-inner>
              <v-btn icon variant="text" size="small" @click="showAgentApiKey = !showAgentApiKey">
                <v-icon>{{ showAgentApiKey ? 'visibility_off' : 'visibility' }}</v-icon>
              </v-btn>
            </template>
          </v-text-field>
        </template>
      </SettingItem>

      <v-divider class="my-3" />

      <SettingItem :title="t('setting.aiAgentModel')" :description="t('setting.aiAgentModelDescription')">
        <template #title>
          <v-icon start size="small" color="primary">tune</v-icon>
          {{ t('setting.aiAgentModel') }}
        </template>
        <template #action>
          <v-text-field
            v-model="agentModel"
            variant="outlined"
            density="compact"
            class="setting-item-input"
            hide-details
            placeholder="agnes-2.0-flash"
          />
        </template>
      </SettingItem>

      <v-divider class="my-3" />

      <SettingItem :title="t('setting.aiAgentEndpoint')" :description="t('setting.aiAgentEndpointDescription')">
        <template #title>
          <v-icon start size="small" color="primary">link</v-icon>
          {{ t('setting.aiAgentEndpoint') }}
        </template>
        <template #action>
          <v-text-field
            v-model="agentEndpoint"
            variant="outlined"
            density="compact"
            class="setting-item-input"
            hide-details
            placeholder="https://apihub.agnes-ai.com/v1/chat/completions"
          />
        </template>
      </SettingItem>
    </template>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { useAgentSettings } from '../composables/agent/settings'
import { useGameDirectory, useSettings } from '../composables/setting'

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
const {
  apiKey: agentApiKey,
  endpoint: agentEndpoint,
  model: agentModel,
} = useAgentSettings()
const showAgentApiKey = ref(false)

const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')

</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-list-item {
  min-height: 64px;
}

.v-list-item__action {
  align-self: center;
}

.setting-item-input {
  min-width: 320px;
  max-width: 460px;
}
</style>
