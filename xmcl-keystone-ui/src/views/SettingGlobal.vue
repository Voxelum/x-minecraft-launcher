<!-- src/components/SettingGlobal.vue -->
<template>
  <div class="flex flex-col gap-4">
    <!-- Quick Launch Settings Card -->
    <SettingCard :title="t('setting.quickLaunchSettings')" icon="flash_on">
      <SettingItemCheckbox :value="fastLaunch" @input="fastLaunch = $event" :title="t('instanceSetting.fastLaunch')"
        :description="t('instanceSetting.fastLaunchHint')" />
      <v-divider class="my-2" />
      <SettingItemCheckbox :value="hideLauncher" @input="hideLauncher = $event" :title="t('instanceSetting.hideLauncher')" />
      <v-divider class="my-2" />
      <SettingItemCheckbox :value="showLog" @input="showLog = $event" :title="t('instanceSetting.showLog')"
        :description="t('instanceSetting.showLogHint')" />
    </SettingCard>

    <SettingCard :title="t('setting.authenticationSettings')" icon="security">
      <SettingItemCheckbox :value="disableAuthlibInjector" @input="disableAuthlibInjector = $event" :title="t('instanceSetting.disableAuthlibInjector')"
        :description="t('instanceSetting.disableAuthlibInjectorDescription')" />
      <v-divider class="my-2" />
      <SettingItemCheckbox :value="disableElyByAuthlib" @input="disableElyByAuthlib = $event" :title="t('instanceSetting.disableElyByAuthlib')"
        :description="t('instanceSetting.disableElyByAuthlibDescription')" />
    </SettingCard>

    <!-- Java Memory Settings Card -->
    <SettingCard :title="t('java.memory')" icon="memory">
      <div class="d-flex align-center mb-3">
        <span class="font-weight-medium mr-3">{{ t('setting.memoryAssignment') || 'Назначение памяти' }}</span>
        <v-spacer />
        <SettingJavaMemoryAssign :value="assignMemory" @input="assignMemory = $event" />
      </div>
      <SettingJavaMemory :assign-memory="assignMemory" :min.sync="minMem" :max.sync="maxMem" />
    </SettingCard>

    <!-- Advanced Java Options Card -->
    <SettingCard :title="t('setting.advancedJavaOptions')" icon="code">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="font-weight-medium mb-2">
            <v-icon left small>terminal</v-icon>
            {{ t("instance.prependCommand") }}
          </div>
          <v-text-field v-model="prependCommand" outlined dense filled hide-details
            :placeholder="t('instance.prependCommandHint')" />
        </div>
        <div>
          <div class="font-weight-medium mb-2">
            <v-icon left small>settings_applications</v-icon>
            {{ t("instance.vmOptions") }}
          </div>
          <v-text-field v-model="vmOptions" outlined dense filled hide-details
            :placeholder="t('instance.vmOptionsHint')" />
        </div>
      </div>
    </SettingCard>

    <!-- Environment Variables Card -->
    <SettingCard :title="t('instance.vmVar')" icon="eco">
      <div class="flex justify-between items-center mb-3">
        <div class="text-subtitle-2">
          {{ t("instance.vmVarHint") }}
        </div>
        <v-btn small color="primary" outlined @click="onAddEnvVar">
          <v-icon left small>add</v-icon>
          {{ t('add') || 'Добавить' }}
        </v-btn>
      </div>
      <EnvVarTableItem :env="env" @delete="onEnvVarDeleted" />
      <EnvVarAddItem v-if="adding" @clear="onEnvVarCleared" @add="onEnvVarAdded" />
    </SettingCard>

    <!-- Minecraft Options Card -->
    <SettingCard :title="t('setting.minecraftOptions')" icon="videogame_asset">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="font-weight-medium mb-2">
            <v-icon left small>play_arrow</v-icon>
            {{ t("instance.preExecCommand") }}
          </div>
          <v-text-field v-model="preExecuteCommand" outlined dense filled hide-details
            :placeholder="t('instance.preExecCommandHint')" />
        </div>
        <div>
          <div class="font-weight-medium mb-2">
            <v-icon left small>tune</v-icon>
            {{ t("instance.mcOptions") }}
          </div>
          <v-text-field v-model="mcOptions" outlined dense filled hide-details
            :placeholder="t('instance.mcOptionsHint')" />
        </div>
      </div>
    </SettingCard>

    <!-- Game Window Resolution Card -->
    <SettingCard :title="t('instance.resolution')" icon="aspect_ratio">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        <v-text-field v-model="resolutionWidth" :label="t('instance.width')" type="number" outlined dense filled
          hide-details />
        <v-text-field v-model="resolutionHeight" :label="t('instance.height')" type="number" outlined dense filled
          hide-details />
        <v-switch v-model="resolutionFullscreen" :label="t('instance.fullscreen')" class="mt-0" color="primary" hide-details />
        <v-select v-model="selectedResolutionPreset" :items="resolutionPresets" item-text="text" item-value="value"
          :label="t('instance.resolutionPreset')" outlined filled hide-details dense />
      </div>
    </SettingCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { useEventListener } from '@vueuse/core'
import { useGlobalSettings } from '@/composables/setting'
import { useResolutionPresets } from '@/composables/resolutionPresets'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import EnvVarTableItem from '@/components/EnvVarTableItem.vue'
import EnvVarAddItem from '@/components/EnvVarAddItem.vue'
import SettingCard from '@/components/SettingCard.vue'

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

// --- Reactive State (Form Data) ---
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
const adding = ref(false) // For adding environment variables

// Resolution Settings
const resolutionFullscreen = ref(globalResolution.value?.fullscreen)
const resolutionWidth = ref(globalResolution.value?.width)
const resolutionHeight = ref(globalResolution.value?.height)
const resolutionPresets = useResolutionPresets()

// --- Computed Properties ---
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

// --- Lifecycle Hooks ---
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

// --- Methods ---
function save() {
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

// --- Environment Variable Management ---
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

// Save settings when the component is unmounted or the user leaves the page
onUnmounted(save)
useEventListener('beforeunload', save)

</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
