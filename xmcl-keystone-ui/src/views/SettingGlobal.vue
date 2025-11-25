<template>
  <div class="settings-page">
    <SettingHeader>
      🌍 {{ t('setting.globalSetting') }}
    </SettingHeader>

    <div class="content-grid">
      <!-- Launch Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">rocket_launch</v-icon>
          {{ t('setting.launchSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemCheckbox v-model="fastLaunch" :title="t('instanceSetting.fastLaunch')"
            :text="t('instanceSetting.fastLaunch')" :description="t('instanceSetting.fastLaunchHint')" />
          <SettingItemCheckbox v-model="hideLauncher" :title="t('instanceSetting.hideLauncher')"
            :text="t('instanceSetting.hideLauncher')" />
          <SettingItemCheckbox v-model="showLog" :title="t('instanceSetting.showLog')"
            :text="t('instanceSetting.showLog')" :description="t('instanceSetting.showLogHint')" />
        </div>
      </div>

      <!-- Authentication Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">security</v-icon>
          {{ t('setting.authSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemCheckbox v-model="disableAuthlibInjector" :title="t('instanceSetting.disableAuthlibInjector')"
            :text="t('instanceSetting.disableAuthlibInjector')"
            :description="t('instanceSetting.disableAuthlibInjectorDescription')" />
          <SettingItemCheckbox v-model="disableElyByAuthlib" :title="t('instanceSetting.disableElyByAuthlib')"
            :text="t('instanceSetting.disableElyByAuthlib')"
            :description="t('instanceSetting.disableElyByAuthlibDescription')" />
        </div>
      </div>

      <!-- Java Memory Settings -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">memory</v-icon>
          {{ t("java.memory") }}
        </h3>
        <div class="memory-settings">
          <div class="memory-header">
            <span>{{ t('java.memoryAllocation') }}</span>
            <SettingJavaMemoryAssign v-model="assignMemory" />
          </div>
          <SettingJavaMemory :assign-memory="assignMemory" :min.sync="minMem" :max.sync="maxMem" />
        </div>
      </div>

      <!-- Command Options -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">terminal</v-icon>
          {{ t('setting.commandOptions') }}
        </h3>
        <div class="command-grid">
          <div class="input-item">
            <label>{{ t("instance.prependCommand") }}</label>
            <v-text-field v-model="prependCommand" class="custom-input" hide-details dense outlined
              :placeholder="t('instance.prependCommandHint')" />
          </div>
          <div class="input-item">
            <label>{{ t("instance.vmOptions") }}</label>
            <v-text-field v-model="vmOptions" class="custom-input" hide-details dense outlined
              :placeholder="t('instance.vmOptionsHint')" />
          </div>
          <div class="input-item">
            <label>{{ t("instance.preExecCommand") }}</label>
            <v-text-field v-model="preExecuteCommand" class="custom-input" hide-details dense outlined
              :placeholder="t('instance.preExecCommandHint')" />
          </div>
          <div class="input-item">
            <label>{{ t("instance.mcOptions") }}</label>
            <v-text-field v-model="mcOptions" class="custom-input" hide-details dense outlined
              :placeholder="t('instance.mcOptionsHint')" />
          </div>
        </div>
      </div>

      <!-- Environment Variables -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">code</v-icon>
          {{ t("instance.vmVar") }}
        </h3>
        <p class="card-description">{{ t("instance.vmVarHint") }}</p>
        <div class="env-controls">
          <v-btn color="primary" @click="onAddEnvVar">
            <v-icon left>add</v-icon>
            {{ t('common.add') }}
          </v-btn>
        </div>
        <EnvVarTableItem :env="env" @delete="onEnvVarDeleted" />
        <EnvVarAddItem v-if="adding" @clear="onEnvVarCleared" @add="onEnvVarAdded" />
      </div>

      <!-- Display Settings -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">desktop_windows</v-icon>
          {{ t("instance.resolution") }}
        </h3>
        <div class="resolution-layout">
          <div class="resolution-inputs">
            <v-text-field v-model="resolutionWidth" :label="t('instance.width')" type="number" outlined dense
              hide-details class="custom-input" />
            <span class="separator">×</span>
            <v-text-field v-model="resolutionHeight" :label="t('instance.height')" type="number" outlined dense
              hide-details class="custom-input" />
          </div>
          <div class="resolution-options">
            <v-switch v-model="resolutionFullscreen" :label="t('instance.fullscreen')" class="ma-0 pa-0" hide-details />
            <v-select v-model="selectedResolutionPreset" :items="resolutionPresets" item-text="text" item-value="value"
              :label="t('instance.resolutionPreset')" outlined hide-details dense class="custom-input" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGlobalSettings } from '@/composables/setting'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import { useEventListener } from '@vueuse/core'
import EnvVarTableItem from '@/components/EnvVarTableItem.vue'
import EnvVarAddItem from '@/components/EnvVarAddItem.vue'
import { computed } from 'vue'
import { useResolutionPresets } from '@/composables/resolutionPresets'

const { t } = useI18n()
const {
  globalAssignMemory,
  globalMaxMemory,
  globalMinMemory,
  globalVmOptions,
  globalMcOptions,
  globalFastLaunch,
  globalHideLauncher,
  globalShowLog,
  globalDisableAuthlibInjector,
  globalDisableElyByAuthlib,
  globalPrependCommand,
  globalPreExecuteCommand,
  globalEnv,
  globalResolution,
  setGlobalSettings,
} = useGlobalSettings()

const assignMemory = ref(globalAssignMemory.value)
const minMem = ref(globalMinMemory.value)
const maxMem = ref(globalMaxMemory.value)
const vmOptions = ref(globalVmOptions.value.join(' '))
const prependCommand = ref(globalPrependCommand.value)
const preExecuteCommand = ref(globalPreExecuteCommand.value)
const mcOptions = ref(globalMcOptions.value.join(' '))
const fastLaunch = ref(globalFastLaunch.value)
const hideLauncher = ref(globalHideLauncher.value)
const showLog = ref(globalShowLog.value)
const disableAuthlibInjector = ref(globalDisableAuthlibInjector.value)
const disableElyByAuthlib = ref(globalDisableElyByAuthlib.value)
const env = ref(globalEnv.value)

const resolutionFullscreen = ref(globalResolution.value?.fullscreen)
const resolutionWidth = ref(globalResolution.value?.width)
const resolutionHeight = ref(globalResolution.value?.height)

const resolutionPresets = useResolutionPresets()

const selectedResolutionPreset = computed({
  get: () => {
    const width = resolutionWidth.value
    const height = resolutionHeight.value
    const preset = resolutionPresets.value.find(p => p.value.width === width && p.value.height === height)
    return preset ? preset.value : { width, height }
  },
  set: (value) => {
    resolutionWidth.value = value.width
    resolutionHeight.value = value.height
  }
})

onMounted(() => {
  assignMemory.value = globalAssignMemory.value
  minMem.value = globalMinMemory.value
  maxMem.value = globalMaxMemory.value
  vmOptions.value = globalVmOptions.value.join(' ')
  mcOptions.value = globalMcOptions.value.join(' ')
  fastLaunch.value = globalFastLaunch.value
  hideLauncher.value = globalHideLauncher.value
  showLog.value = globalShowLog.value
  disableAuthlibInjector.value = globalDisableAuthlibInjector.value
  disableElyByAuthlib.value = globalDisableElyByAuthlib.value
  prependCommand.value = globalPrependCommand.value
  preExecuteCommand.value = globalPreExecuteCommand.value

  if (globalResolution.value) {
    resolutionFullscreen.value = globalResolution.value.fullscreen
    resolutionWidth.value = globalResolution.value.width
    resolutionHeight.value = globalResolution.value.height
  }
})

const save = () => {
  setGlobalSettings({
    globalAssignMemory: assignMemory.value,
    globalMaxMemory: maxMem.value,
    globalMinMemory: minMem.value,
    globalVmOptions: vmOptions.value.split(' ').filter(s => !!s),
    globalMcOptions: mcOptions.value.split(' ').filter(s => !!s),
    globalFastLaunch: fastLaunch.value,
    globalHideLauncher: hideLauncher.value,
    globalShowLog: showLog.value,
    globalDisableAuthlibInjector: disableAuthlibInjector.value,
    globalDisableElyByAuthlib: disableElyByAuthlib.value,
    globalPrependCommand: prependCommand.value,
    globalPreExecuteCommand: preExecuteCommand.value,
    globalEnv: env.value,
    globalResolution: {
      width: resolutionWidth.value,
      height: resolutionHeight.value,
      fullscreen: resolutionFullscreen.value,
    },
  })
}

const adding = ref(false)
function onAddEnvVar() {
  adding.value = true
}
function onEnvVarCleared() {
  adding.value = false
}
function onEnvVarAdded(key: string, value: string) {
  adding.value = false
  if (key === '') return
  env.value = { ...env.value, [key]: value }
}
function onEnvVarDeleted(key: string) {
  const { [key]: _, ...rest } = env.value
  env.value = rest
}

useEventListener('beforeunload', save)
onUnmounted(save)
</script>

<style scoped>
.settings-page {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.settings-card {
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.settings-card.full-width {
  grid-column: 1 / -1;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.title-icon {
  color: var(--v-primary-base);
  font-size: 1.3rem;
}

.card-description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin-bottom: 20px;
  line-height: 1.5;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.memory-settings,
.resolution-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.input-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-item label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
}

.env-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.resolution-inputs {
  display: flex;
  align-items: center;
  gap: 16px;
}

.separator {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
  font-size: 1.2rem;
}

.resolution-options {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.custom-input {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.custom-input.v-text-field--outlined fieldset {
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-input.v-text-field--outlined:hover fieldset {
  border-color: rgba(255, 255, 255, 0.3);
}

.custom-input.v-text-field--outlined.v-input--is-focused fieldset {
  border-color: var(--v-primary-base);
}

:deep(.v-list-item) {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 0;
  transition: background-color 0.2s ease;
}

:deep(.v-list-item:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-list-item__title) {
  color: rgba(255, 255, 255, 0.95) !important;
  font-size: 0.95rem !important;
}

:deep(.v-list-item__subtitle) {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.85rem !important;
  white-space: normal !important;
  line-height: 1.4 !important;
}
</style>
