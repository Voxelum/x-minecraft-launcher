<template>
  <SettingCard
    data-testid="base-setting-bedrock-versions"
    :title="t('bedrock.versionsTitle')"
    :subtitle="t('bedrock.versionsHint')"
    icon="view_in_ar"
  >
    <template #header-action>
      <v-btn
        data-testid="base-setting-bedrock-refresh"
        icon="refresh"
        size="small"
        variant="text"
        :loading="loading"
        :aria-label="t('bedrock.refresh')"
        @click="refresh"
      />
    </template>

    <v-alert
      v-if="!developerMode"
      data-testid="base-setting-bedrock-devmode"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      <div class="mb-2">{{ t('bedrock.developerModeRequired') }}</div>
      <v-btn
        size="small"
        color="warning"
        variant="flat"
        :loading="enablingDeveloperMode"
        @click="enableDeveloperMode"
      >
        {{ t('bedrock.enableDeveloperMode') }}
      </v-btn>
    </v-alert>

    <div
      v-if="installedVersions.length"
      data-testid="base-setting-bedrock-installed"
      class="mb-4 flex flex-col gap-2"
    >
      <div
        v-for="version in installedVersions"
        :key="version.version"
        class="flex items-center gap-2 rounded-lg px-3 py-2"
        style="background: rgba(var(--v-theme-on-surface), 0.05)"
      >
        <v-icon size="20" :color="version.active ? 'primary' : undefined">
          {{ version.active ? 'radio_button_checked' : 'radio_button_unchecked' }}
        </v-icon>
        <span class="font-mono">{{ version.version }}</span>
        <v-chip v-if="version.type !== 'release'" size="x-small" label>
          {{ version.type }}
        </v-chip>
        <v-chip v-if="version.active" size="x-small" color="primary" label>
          {{ t('bedrock.active') }}
        </v-chip>
        <v-spacer />
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :loading="busyVersion === version.version"
          :disabled="!!busyVersion"
          @click="play(version)"
        >
          <v-icon start>play_arrow</v-icon>
          {{ t('bedrock.play') }}
        </v-btn>
        <v-btn
          icon="delete"
          size="small"
          variant="text"
          :loading="busyVersion === version.version"
          :disabled="!!busyVersion"
          :aria-label="t('shared.delete')"
          @click="remove(version)"
        />
      </div>
    </div>

    <v-select
      v-model="typeFilter"
      :items="typeItems"
      :label="t('bedrock.channel')"
      density="compact"
      variant="outlined"
      hide-details
      class="mb-2"
    />
    <v-progress-circular v-if="loading" indeterminate color="primary" size="24" />
    <div v-else-if="loadError" class="text-caption text-error">
      {{ t('bedrock.versionsError') }}
    </div>
    <div
      v-else
      data-testid="base-setting-bedrock-available"
      class="max-h-[280px] overflow-auto rounded-lg"
      style="border: 1px solid rgba(var(--v-theme-on-surface), 0.12)"
    >
      <div
        v-for="version in filteredAvailable"
        :key="version.version"
        class="flex items-center gap-2 px-3 py-1.5"
        style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08)"
      >
        <span class="font-mono">{{ version.version }}</span>
        <v-chip v-if="version.type !== 'release'" size="x-small" label>
          {{ version.type }}
        </v-chip>
        <v-spacer />
        <span
          v-if="isInstalled(version.version)"
          class="text-caption"
          style="color: rgba(var(--v-theme-on-surface), 0.5)"
        >
          {{ t('bedrock.installedTag') }}
        </span>
        <v-btn
          v-else
          size="small"
          variant="tonal"
          :loading="busyVersion === version.version"
          :disabled="!!busyVersion"
          @click="install(version)"
        >
          <v-icon start>get_app</v-icon>
          {{ t('bedrock.download') }}
        </v-btn>
      </div>
    </div>
  </SettingCard>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { useService } from '@/composables'
import { useLocaleError } from '@/composables/error'
import { useNotifier } from '@/composables/notifier'
import {
  BedrockInstalledVersion,
  BedrockServiceKey,
  BedrockVersion,
  BedrockVersionType,
} from '@xmcl/runtime-api'

const { t } = useI18n()
const {
  getVersionList,
  getInstalledVersions,
  installVersion,
  removeVersion,
  launchVersion,
  isDeveloperModeEnabled,
  enableDeveloperMode: enableDeveloperModeService,
} = useService(BedrockServiceKey)
const { notify } = useNotifier()
const tError = useLocaleError()

const loading = ref(true)
const loadError = ref(false)
const developerMode = ref(true)
const enablingDeveloperMode = ref(false)
const installedVersions = ref<BedrockInstalledVersion[]>([])
const availableVersions = ref<BedrockVersion[]>([])
const typeFilter = ref<BedrockVersionType>('release')
const busyVersion = ref('')

const typeItems = computed(() => [
  { title: t('bedrock.channelRelease'), value: 'release' },
  { title: t('bedrock.channelBeta'), value: 'beta' },
  { title: t('bedrock.channelPreview'), value: 'preview' },
])
const filteredAvailable = computed(() =>
  availableVersions.value.filter(version => version.type === typeFilter.value),
)

function isInstalled(version: string) {
  return installedVersions.value.some(installed => installed.version === version)
}

async function refresh() {
  loading.value = true
  loadError.value = false
  try {
    developerMode.value = await isDeveloperModeEnabled()
    installedVersions.value = await getInstalledVersions()
    availableVersions.value = await getVersionList()
  } catch (error) {
    loadError.value = true
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function enableDeveloperMode() {
  enablingDeveloperMode.value = true
  try {
    await enableDeveloperModeService()
    developerMode.value = await isDeveloperModeEnabled()
  } catch (error) {
    notify({
      title: t('bedrock.downloadFailed', { version: '' }),
      body: t('bedrock.enableDeveloperModeFailed'),
      level: 'error',
    })
    console.error(error)
  } finally {
    enablingDeveloperMode.value = false
  }
}

async function install(version: BedrockVersion) {
  busyVersion.value = version.version
  try {
    await installVersion({
      version: version.version,
      updateIdentity: version.updateIdentity,
      type: version.type,
    })
    installedVersions.value = await getInstalledVersions()
  } catch (error) {
    notify({
      title: t('bedrock.downloadFailed', { version: version.version }),
      body: tError(error),
      level: 'error',
    })
    console.error(error)
  } finally {
    busyVersion.value = ''
  }
}

async function play(version: BedrockInstalledVersion) {
  busyVersion.value = version.version
  try {
    await launchVersion(version.version)
    installedVersions.value = await getInstalledVersions()
  } catch (error) {
    notify({ title: t('bedrock.launchFailed'), level: 'error' })
    console.error(error)
  } finally {
    busyVersion.value = ''
  }
}

async function remove(version: BedrockInstalledVersion) {
  busyVersion.value = version.version
  try {
    await removeVersion(version.version)
    installedVersions.value = await getInstalledVersions()
  } catch (error) {
    notify({ title: t('bedrock.removeFailed', { version: version.version }), level: 'error' })
    console.error(error)
  } finally {
    busyVersion.value = ''
  }
}

onMounted(refresh)
</script>