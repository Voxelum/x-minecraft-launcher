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
            solo
            :placeholder="t('instance.vmOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content style="flex: 1">
        <v-list-item-title>
          {{ t("instance.mcOptions") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="mcOptions"
            solo
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
  setGlobalSettings,
} = useGlobalSettings()

const assignMemory = ref(globalAssignMemory.value)
const minMem = ref(globalMinMemory.value)
const maxMem = ref(globalMaxMemory.value)
const vmOptions = ref(globalVmOptions.value.join(' '))
const mcOptions = ref(globalMcOptions.value.join(' '))
const fastLaunch = ref(globalFastLaunch.value)
const hideLauncher = ref(globalHideLauncher.value)
const showLog = ref(globalShowLog.value)

onMounted(() => {
  assignMemory.value = globalAssignMemory.value
  minMem.value = globalMinMemory.value
  maxMem.value = globalMaxMemory.value
  vmOptions.value = globalVmOptions.value.join(' ')
  mcOptions.value = globalMcOptions.value.join(' ')
  fastLaunch.value = globalFastLaunch.value
  hideLauncher.value = globalHideLauncher.value
  showLog.value = globalShowLog.value
})

onUnmounted(() => {
  setGlobalSettings({
    globalAssignMemory: assignMemory.value,
    globalMaxMemory: maxMem.value,
    globalMinMemory: minMem.value,
    globalVmOptions: vmOptions.value.split(' ').filter(s => !!s),
    globalMcOptions: mcOptions.value.split(' ').filter(s => !!s),
    globalFastLaunch: fastLaunch.value,
    globalHideLauncher: hideLauncher.value,
    globalShowLog: showLog.value,
  })
})

</script>
