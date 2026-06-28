<template>
  <div class="flex flex-col gap-4">
    <!-- Network Settings -->
    <SettingCard :title="t('setting.network')" icon="wifi">
      <SettingItemSelect
        v-model="apiSetsPreference"
        :title="t('setting.useBmclAPI')"
        :description="t('setting.useBmclAPIDescription')"
        :items="apiSetItems"
        :search-query="searchQuery"
      >
        <template #title>
          {{ t('setting.useBmclAPI') }}
          <a
            class="primary ml-1 underline"
            target="browser"
            href="https://bmclapidoc.bangbang93.com/"
          >
            <v-icon size="small">question_mark</v-icon>
          </a>
        </template>
      </SettingItemSelect>

      <v-divider class="my-3 opacity-20" />

      <!-- Proxy Settings -->
      <SettingItemCheckbox
        :title="t('setting.useProxy')"
        :description="t('setting.useProxyDescription')"
        v-model="httpProxyEnabled"
        :search-query="searchQuery"
      />
      <v-expand-transition>
        <div v-if="httpProxyEnabled" class="px-4 py-2">
          <div class="d-flex gap-4">
            <v-text-field
              v-model="proxy.host"
              data-testid="settings-proxy-host"
              variant="filled"
              density="compact"
              hide-details
              :label="t('proxy.host')"
              prepend-inner-icon="dns"
              class="flex-grow-1"
            />
            <v-text-field
              v-model="proxy.port"
              class="w-24 flex-grow-0"
              variant="filled"
              density="compact"
              hide-details
              type="number"
              :label="t('proxy.port')"
              prepend-inner-icon="numbers"
            />
          </div>
        </div>
      </v-expand-transition>

      <v-divider class="my-3 opacity-20" />

      <SettingItem :title="t('setting.maxSocketsTitle')" :description="t('setting.maxSocketsDescription')" :search-query="searchQuery">
        <template #action>
          <v-text-field
            v-model="maxSockets"
            class="w-32"
            variant="filled"
            density="compact"
            hide-details
            type="number"
            :label="t('setting.maxSockets')"
            prepend-inner-icon="speed"
          />
        </template>
      </SettingItem>
    </SettingCard>

    <!-- Integrations -->
    <SettingCard title="Integrations" icon="extension">
      <!-- Discord Presence -->
      <SettingItemSwitcher
        v-model="enableDiscord"
        :title="t('setting.enableDiscord')"
        :description="t('setting.enableDiscordDescription')"
        icon="discord"
        :search-query="searchQuery"
      />

      <v-divider class="my-3 opacity-20" />
      
      <!-- Privacy & Telemetry -->
      <SettingItemSwitcher
        v-model="disableTelemetry"
        :title="t('setting.disableTelemetry')"
        :description="t('setting.disableTelemetryDescription')"
        icon="privacy_tip"
        :search-query="searchQuery"
      />

      <!-- Streamer Mode -->
      <v-divider class="my-3 opacity-20" />
      <SettingItemSwitcher
        v-model="streamerMode"
        :title="t('setting.streamerMode')"
        :description="t('setting.streamerModeDescription')"
        icon="videocam"
        :search-query="searchQuery"
      />

      <!-- Developer Mode -->
      <v-divider class="my-3 opacity-20" />
      <SettingItemSwitcher
        v-model="developerMode"
        :title="t('setting.developerMode')"
        :description="t('setting.developerModeDescription')"
        icon="code"
        :search-query="searchQuery"
      >
        <template #title>
          {{ t('setting.developerMode') }}
          <v-chip v-if="developerMode" size="x-small" color="warning" class="ml-2">{{ t('setting.devModeLabel') }}</v-chip>
        </template>
      </SettingItemSwitcher>

      <v-divider class="my-3 opacity-20" />

      <SettingItemSelect
        :model-value="replaceNative === false ? '' : replaceNative"
        icon="swap_horiz"
        :title="t('setting.replaceNative')"
        :description="t('setting.replaceNativeDescription')"
        :items="replaceNativeItems"
        :search-query="searchQuery"
        @update:model-value="replaceNative = !$event ? false : $event"
      />

      <template v-if="developerMode">
        <v-divider class="my-3 opacity-20" />
        <SettingItem :title="t('setting.aiAgentApiKey')" :description="t('setting.aiAgentApiKeyDescription')" :search-query="searchQuery">
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

        <v-divider class="my-3 opacity-20" />

        <SettingItem :title="t('setting.aiAgentModel')" :description="t('setting.aiAgentModelDescription')" :search-query="searchQuery">
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

        <v-divider class="my-3 opacity-20" />

        <SettingItem :title="t('setting.aiAgentEndpoint')" :description="t('setting.aiAgentEndpointDescription')" :search-query="searchQuery">
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
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useSettings } from '../composables/setting'
import { useAgentSettings } from '../composables/agent/settings'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'

defineProps<{
  searchQuery?: string
}>()

const {
  proxy, httpProxyEnabled, apiSets,
  apiSetsPreference,
  maxSockets,
  streamerMode,
  developerMode,
  replaceNative,
  disableTelemetry,
  enableDiscord,
} = useSettings()

const { t } = useI18n()

const apiSetItems = computed(() =>
  [
    {
      text: t('setting.apiSets.auto'),
      value: '',
    },
    {
      text: t('setting.apiSets.official'),
      value: 'mojang',
    },
  ].concat(
    apiSets.value.map((v) => {
      return {
        text: v.name.toString().toUpperCase(),
        value: v.name,
      }
    })))

const replaceNativeItems = computed(() => [
  { text: t('shared.disable'), value: '' },
  { text: t('setting.replaceNatives.legacy'), value: 'legacy-only' },
  { text: t('setting.replaceNatives.all'), value: 'all' },
])

const {
  apiKey: agentApiKey,
  endpoint: agentEndpoint,
  model: agentModel,
} = useAgentSettings()
const showAgentApiKey = ref(false)

</script>

<style scoped>
.setting-item-input {
  min-width: 320px;
  max-width: 460px;
}
</style>
