<template>
  <SettingHeader>
    <div class="flex flex-col">
      🌍 {{ t('setting.globalSetting') }}

      <v-list-subheader class="my-0 h-[unset] px-0">
        {{ t('setting.globalSettingHint') }}
      </v-list-subheader>
    </div>
  </SettingHeader>
  <SettingItemCheckbox
    v-model="fastLaunch"
    :title="t('instanceSetting.fastLaunch')"
    :description="t('instanceSetting.fastLaunchHint')"
  />
  <SettingItemCheckbox
    v-model="hideLauncher"
    :title="t('instanceSetting.hideLauncher')"
  />
  <SettingItemCheckbox
    v-model="showLog"
    :title="t('instanceSetting.showLog')"
    :description="t('instanceSetting.showLogHint')"
  />
  <SettingItemCheckbox
    v-model="disableAuthlibInjector"
    :title="t('instanceSetting.disableAuthlibInjector')"
    :description="t('instanceSetting.disableAuthlibInjectorDescription')"
  />
  <SettingItemCheckbox
    v-model="disableElyByAuthlib"
    :title="t('instanceSetting.disableElyByAuthlib')"
    :description="t('instanceSetting.disableElyByAuthlibDescription')"
  />

  <v-list-item :title="t('java.memory')">
    <div class="mt-2 flex flex-col gap-2 px-[16px] py-[8px]">
      <div class="flex flex-row items-center">
        <div class="flex-grow" />
        <SettingJavaMemoryAssign v-model="assignMemory" />
      </div>
      <SettingJavaMemory
        v-model:min="minMem"
        v-model:max="maxMem"
        :assign-memory="assignMemory"
      />
    </div>
  </v-list-item>
  <div
    class="grid grid-cols-4 gap-1 mt-2"
  >
    <v-list-item :title="t('instance.prependCommand')">
      <template #subtitle>
        <v-text-field
          v-model="prependCommand"
          v-shared-tooltip="_ => t('instance.prependCommandHint')"
          class="mt-2"
          hide-details
          required
          density="compact"
          variant="filled"
          :placeholder="t('instance.prependCommandHint')"
        />
      </template>
    </v-list-item>
      
    <v-list-item
      class="col-span-3"
      :title="t('instance.vmOptions')"
    >
      <v-list-item-subtitle>
        <v-text-field
          v-model="vmOptions"
          class="mt-2"
          hide-details
          required
          density="compact"
          variant="filled"
          :placeholder="t('instance.vmOptionsHint')"
        />
      </v-list-item-subtitle>
    </v-list-item>
  </div>

  <v-list-item
    :title="t('instance.vmVar')"
    :subtitle="t('instance.vmVarHint')"
  > 
    <template #append>
      <v-list-item-action>
        <v-btn
          icon
          variant="text"
          @click="onAddEnvVar"
        >
          <v-icon>add</v-icon>
        </v-btn>
      </v-list-item-action>
    </template>
  </v-list-item>

  <EnvVarTableItem
    :env="env"
    @delete="onEnvVarDeleted"
  />

  <EnvVarAddItem
    v-if="adding"
    @clear="onEnvVarCleared"
    @add="onEnvVarAdded"
  />

  <div class="grid grid-cols-4">
    <v-list-item :title="t('instance.preExecCommand')">
      <template #subtitle>
        <v-text-field
          v-model="preExecuteCommand"
          class="mt-2"
          hide-details
          required
          density="compact"
          variant="filled"
          :placeholder="t('instance.preExecCommandHint')"
        />
      </template>
    </v-list-item>

    <v-list-item
      class="col-span-3"
      :title="t('instance.mcOptions')"
    >
      <template #subtitle>
        <v-text-field
          v-model="mcOptions"
          density="compact"
          variant="filled"
          class="mt-2"
          hide-details
          required
          :placeholder="t('instance.mcOptionsHint')"
        />
      </template>
    </v-list-item>
  </div>
    
  <v-list-item :title="t('instance.resolution')">
    <div class="mt-2 flex flex-row items-center gap-2">
      <v-text-field
        v-model="resolutionWidth"
        :label="t('instance.width')"
        type="number"
        variant="filled"
        density="compact"
        hide-details
        class="mr-2 max-w-[150px]"
      />
      <v-text-field
        v-model="resolutionHeight"
        :label="t('instance.height')"
        type="number"
        variant="filled"
        density="compact"
        hide-details
        class="ml-2 max-w-[150px]"
      />
      <v-switch
        v-model="resolutionFullscreen"
        :label="t('instance.fullscreen')"
        class="ma-0 pa-0"
        hide-details
      />
      <v-spacer />
      <v-select
        v-model="selectedResolutionPreset"
        :items="resolutionPresets"
        item-title="text"
        item-value="value"
        :label="t('instance.resolutionPreset')"
        variant="filled"
        hide-details
        density="compact"
        class="max-w-[300px]"
      />
    </div>
  </v-list-item>
</template>

<script setup lang="ts">
import { useGlobalSettings } from '@/composables/setting'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import { useEventListener } from '@vueuse/core'
import { vSharedTooltip } from '@/directives/sharedTooltip'
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
