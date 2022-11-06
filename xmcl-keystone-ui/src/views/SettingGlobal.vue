<template>
  <v-list
    two-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader style="padding-right: 2px">
      <div class="flex flex-col">
        {{ t('setting.globalSetting') }}

        <span class="text-xs italic">
          {{ t('setting.globalSettingHint') }}
        </span>
      </div>
    </v-subheader>
    <v-list-item
      @click="fastLaunch = !fastLaunch"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="fastLaunch"
          hide-details
          @click="fastLaunch = !fastLaunch"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.fastLaunch") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.fastLaunchHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item
      @click="hideLauncher = !hideLauncher"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="hideLauncher"
          hide-details
          @click="hideLauncher = !hideLauncher"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("instanceSetting.hideLauncher")
          }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      @click="showLog = !showLog"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="showLog"
          hide-details
          @click="showLog = !showLog"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.showLog") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.showLogHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item>
      <div class="flex flex-col px-[16px] py-[8px] gap-2 mt-2">
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
  </v-list>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'

const { t } = useI18n()
const { state } = useService(BaseServiceKey)

const assignMemory = ref(state.globalAssignMemory)
const minMem = ref(state.globalMinMemory)
const maxMem = ref(state.globalMaxMemory)
const vmOptions = ref(state.globalVmOptions.join(' '))
const mcOptions = ref(state.globalMcOptions.join(' '))
const fastLaunch = ref(state.globalFastLaunch)
const hideLauncher = ref(state.globalHideLauncher)
const showLog = ref(state.globalShowLog)

onMounted(() => {
  assignMemory.value = state.globalAssignMemory
  minMem.value = state.globalMinMemory
  maxMem.value = state.globalMaxMemory
  vmOptions.value = state.globalVmOptions.join(' ')
  mcOptions.value = state.globalMcOptions.join(' ')
  fastLaunch.value = state.globalFastLaunch
  hideLauncher.value = state.globalHideLauncher
  showLog.value = state.globalShowLog
})

onUnmounted(() => {
  state.globalInstanceSetting({
    globalAssignMemory: assignMemory.value,
    globalMaxMemory: maxMem.value,
    globalMinMemory: minMem.value,
    globalVmOptions: vmOptions.value.split(' '),
    globalMcOptions: mcOptions.value.split(' '),
    globalFastLaunch: fastLaunch.value,
    globalHideLauncher: hideLauncher.value,
    globalShowLog: showLog.value,
  })
})

</script>
