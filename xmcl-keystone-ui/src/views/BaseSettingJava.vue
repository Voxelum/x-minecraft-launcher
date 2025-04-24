<template>
  <v-list
    style="background: transparent; width: 100%"
  >
    <v-subheader style="padding-right: 2px">
      Java
      <v-spacer />
      <v-btn
        v-shared-tooltip.left="_ => t('java.refresh')"
        icon
        :loading="refreshing"
        @click="refresh"
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
      <div class="mt-2 flex flex-col gap-2 py-[8px]">
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
      :env="allEnv"
      :readonly="readonlyEnv"
      @delete="onEnvVarDeleted"
    />

    <EnvVarAddItem
      v-if="adding"
      @clear="onEnvVarCleared"
      @add="onEnvVarAdded"
    />
    <v-divider />
  </v-list>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kInstanceJava } from '@/composables/instanceJava'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kJavaContext } from '../composables/java'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'
import JavaList from './BaseSettingJavaList.vue'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import EnvVarTableItem from '@/components/EnvVarTableItem.vue'
import EnvVarAddItem from '@/components/EnvVarAddItem.vue'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { all: javas, remove: removeJava, refreshing, refresh } = injection(kJavaContext)
const { java: selectedJava } = injection(kInstanceJava)
const { resolveJava: add } = useService(JavaServiceKey)

const {
  isGlobalAssignMemory,
  isGlobalVmOptions,
  assignMemory,
  isGlobalPrependCommand,
  prependCommand,
  env,
  globalEnv,
  resetPrependCommand,
  resetAssignMemory,
  resetVmOptions,
  maxMemory: maxMem,
  vmOptions,
  minMemory: minMem,
  javaPath,
} = injection(InstanceEditInjectionKey)

const allEnv = computed(() => ({
  ...globalEnv.value,
  ...env.value,
}))
const readonlyEnv = computed(() => {
  const envs = { ...globalEnv.value }
  for (const e in envs) {
    if (env.value[e] !== undefined) {
      delete envs[e]
    }
  }
  return Object.keys(envs)
})

const java = computed({
  get: () => javas.value.find(v => v.path === javaPath.value) || { path: '', valid: false, majorVersion: 0, version: '' },
  set: (v: JavaRecord | undefined) => {
    javaPath.value = v?.path ?? ''
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

#java-list .v-list-group__header:before {
  opacity: 0.08;
}
</style>
