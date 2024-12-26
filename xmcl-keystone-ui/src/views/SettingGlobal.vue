<template>
  <div>
    <SettingHeader>
      <div class="flex flex-col">
        🌍 {{ t('setting.globalSetting') }}

        <v-subheader class="my-0 h-[unset] px-0">
          {{ t('setting.globalSettingHint') }}
        </v-subheader>
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

    <v-list-item>
      <div class="mt-2 flex flex-col gap-2 px-[16px] py-[8px]">
        <div class="flex flex-row items-center">
          {{ t("java.memory") }}
          <div class="flex-grow" />
          <SettingJavaMemoryAssign v-model="assignMemory" />
        </div>
        <SettingJavaMemory
          :assign-memory="assignMemory"
          :min.sync="minMem"
          :max.sync="maxMem"
        />
      </div>
    </v-list-item>
    <v-list-item
      style="margin-top: 5px"
    >
      <v-list-item-content class="max-w-70 mr-4">
        <v-list-item-title>
          {{ t("instance.prependCommand") }}
        </v-list-item-title>
        <v-list-item-subtitle
          v-shared-tooltip="_ => t('instance.prependCommandHint')"
        >
          <v-text-field
            v-model="prependCommand"
            class="m-1 mt-2"
            hide-details
            required
            dense
            outlined
            filled
            :placeholder="t('instance.prependCommandHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instance.vmOptions") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="vmOptions"
            class="m-1 mt-2"
            hide-details
            required
            dense
            outlined
            filled
            :placeholder="t('instance.vmOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instance.vmVar") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.vmVarHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn
          icon
          @click="onAddEnvVar"
        >
          <v-icon>add</v-icon>
        </v-btn>
      </v-list-item-action>
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

    <v-list-item>
      <v-list-item-content style="flex: 1">
        <v-list-item-title>
          {{ t("instance.mcOptions") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="mcOptions"
            dense
            outlined
            filled
            class="m-1 mt-2"
            hide-details
            required
            :placeholder="t('instance.mcOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </div>
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
  globalEnv,
  setGlobalSettings,
} = useGlobalSettings()

const assignMemory = ref(globalAssignMemory.value)
const minMem = ref(globalMinMemory.value)
const maxMem = ref(globalMaxMemory.value)
const vmOptions = ref(globalVmOptions.value.join(' '))
const prependCommand = ref(globalPrependCommand.value)
const mcOptions = ref(globalMcOptions.value.join(' '))
const fastLaunch = ref(globalFastLaunch.value)
const hideLauncher = ref(globalHideLauncher.value)
const showLog = ref(globalShowLog.value)
const disableAuthlibInjector = ref(globalDisableAuthlibInjector.value)
const disableElyByAuthlib = ref(globalDisableElyByAuthlib.value)
const env = ref(globalEnv.value)

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
    globalEnv: env.value,
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
