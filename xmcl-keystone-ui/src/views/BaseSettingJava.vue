<template>
  <v-list
    two-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader style="padding-right: 2px">
      Java
      <v-spacer />
      <v-btn
        v-shared-tooltip.left="_ => t('java.refresh')"
        icon
        :loading="refreshingLocalJava"
        @click="refreshLocalJava"
      >
        <v-icon>refresh</v-icon>
      </v-btn>
      <v-btn
        id="java-import"
        v-shared-tooltip.left="_ => t('java.importFromFile')"
        icon
        @click="browseFile"
      >
        <v-icon>add</v-icon>
      </v-btn>
    </v-subheader>
    <v-list-group
      id="java-list"
      no-action
      :value="true"
    >
      <template #activator>
        <v-list-item
          id="java-list"
        >
          <v-list-item-content>
            <v-list-item-title>
              <span class="h-full self-center object-center text-center">
                {{ t("java.location") }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                java && java.path ? java.path : (selectedJava?.path || t("java.allocatedLong"))
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </template>
      <JavaList
        v-model="java"
        :items="javas"
        :remove="removeJava"
      />
    </v-list-group>
    <v-list-item>
      <div class="mt-2 flex flex-col gap-2 px-[16px] py-[8px]">
        <div class="flex flex-row items-center">
          {{ t("java.memory") }}
          <BaseSettingGlobalLabel
            :global="isGlobalAssignMemory"
            @click="gotoSetting"
            @clear="resetAssignMemory"
          />

          <div class="flex-grow" />
          <SettingJavaMemoryAssign v-model="assignMemory" />
        </div>
        <SettingJavaMemory
          :assign-memory="assignMemory"
          :min.sync="minMem"
          :max.sync="maxMem"
        />
      </div>
      <!-- t('java.noMemory') -->
    </v-list-item>
    <v-list-item
      style="margin-top: 5px"
    >
      <v-list-item-content class="max-w-70 mr-4">
        <v-list-item-title>
          {{ t("instance.prependCommand") }}
          <BaseSettingGlobalLabel
            :global="isGlobalPrependCommand"
            @clear="resetPrependCommand"
            @click="gotoSetting"
          />
        </v-list-item-title>
        <v-list-item-subtitle
          v-shared-tooltip="_ => t('instance.prependCommandHint')"
        >
          <v-text-field
            v-model="prependCommand"
            class="m-1 mt-2"
            hide-details
            required
            outlined
            filled
            dense
            :placeholder="t('instance.prependCommandHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instance.vmOptions") }}
          <BaseSettingGlobalLabel
            :global="isGlobalVmOptions"
            @clear="resetVmOptions"
            @click="gotoSetting"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="vmOptions"
            class="m-1 mt-2"
            hide-details
            required
            outlined
            filled
            dense
            :placeholder="t('instance.vmOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { useService, useServiceBusy } from '@/composables'
import { injection } from '@/util/inject'
import { JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kJavaContext } from '../composables/java'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'
import JavaList from './BaseSettingJavaList.vue'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kInstanceJava } from '@/composables/instanceJava'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { all: javas, remove: removeJava } = injection(kJavaContext)
const { java: selectedJava } = injection(kInstanceJava)
const { resolveJava: add, refreshLocalJava } = useService(JavaServiceKey)
const refreshingLocalJava = useServiceBusy(JavaServiceKey, 'refreshLocalJava')

const {
  isGlobalAssignMemory,
  isGlobalVmOptions,
  assignMemory,
  isGlobalPrependCommand,
  prependCommand,
  resetPrependCommand,
  resetAssignMemory,
  resetVmOptions,
  maxMemory: maxMem,
  vmOptions,
  minMemory: minMem,
  data,
} = injection(InstanceEditInjectionKey)

const java = computed({
  get: () => javas.value.find(v => v.path === data.javaPath) || { path: '', valid: false, majorVersion: 0, version: '' },
  set: (v: JavaRecord | undefined) => {
    data.javaPath = v?.path ?? ''
  },
})

const { push } = useRouter()
const gotoSetting = () => {
  push('/setting')
}

async function browseFile() {
  const { filePaths } = await showOpenDialog({
    title: t('java.importFromFile'),
  })
  filePaths.forEach(add)
}

</script>

<style scoped=true>
.theme--.v-list .v-list__group--active:after,
.theme--.v-list .v-list__group--active:before {
  background: unset;
}
</style>
<style>
.v-textarea.v-text-field--enclosed .v-text-field__slot textarea {
  word-break: break-all;
}
</style>
