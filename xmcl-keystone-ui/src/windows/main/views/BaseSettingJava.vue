<template>
  <v-list
    two-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader style="padding-right: 2px">
      Java
      <v-spacer />
      <v-tooltip left>
        <template #activator="{ on }">
          <v-btn
            icon
            :loading="refreshingLocalJava"
            v-on="on"
            @click="refreshLocalJava"
          >
            <v-icon>refresh</v-icon>
          </v-btn>
        </template>
        {{ t("java.refresh") }}
      </v-tooltip>
      <v-tooltip left>
        <template #activator="{ on }">
          <v-btn
            icon
            @click="browseFile"
            v-on="on"
          >
            <v-icon>add</v-icon>
          </v-btn>
        </template>
        {{ t("java.importFromFile") }}
      </v-tooltip>
    </v-subheader>
    <v-list-group no-action>
      <template #activator>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title>{{ t("java.location") }}</v-list-item-title>
            <v-list-item-subtitle>
              {{
                java && java.path ? java.path : t("java.allocatedLong")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </template>
      <java-list
        v-model="java"
        :items="javas"
        :remove="removeJava"
      />
    </v-list-group>
    <v-list-item>
      <div class="flex flex-col px-[16px] py-[8px]">
        <div class="flex flex-row items-end">
          {{ t("java.memory") }}
          <div class="flex-grow" />
          <v-btn-toggle
            v-model="memoryMode"
            dense
          >
            <v-btn>
              <v-icon
                left
              >
                hide_source
              </v-icon>
              {{ t('java.memoryUnassigned') }}
            </v-btn>
            <v-btn>
              <v-icon
                left
                color="primary"
              >
                memory
              </v-icon>
              {{ t('java.memoryAuto') }}
            </v-btn>
            <v-btn>
              <v-icon
                left
                color="deep-orange"
              >
                pinch
              </v-icon>
              {{ t('java.memoryManual') }}
            </v-btn>
          </v-btn-toggle>
        </div>
        <div class="flex flex-col">
          <!-- {{
            t("java.memoryHint")
          }} -->
          <v-progress-linear
            class="rounded mt-3"
            :value="memoryProgress"
            color="blue"
            height="25"
            reverse
          >
            <template #default>
              <div class="flex items-center justify-center">
                <v-icon
                  left
                >
                  memory
                </v-icon>
                <strong class="flex items-center justify-center flex-grow-0">
                  {{ t('java.systemMemory') }}
                  {{ getExpectedSize(sysmem.free, 'B') }} / {{ getExpectedSize(sysmem.total, 'B') }}
                </strong>
              </div>
            </template>
          </v-progress-linear>

          <v-progress-linear
            class="rounded mt-3"
            :active="instance.assignMemory !== false"
            :value="minMemoryProgress"
            color="deep-orange"
            :buffer-value="maxMemoryProgress"
            striped
            stream
            height="25"
          >
            <template #default>
              <strong class="pl-4">
                {{ t('java.minMemory') + ' ' + getExpectedSize(minMemory, 'B') }}
              </strong>
              <div class="flex-grow" />
              <strong class="pr-4">
                {{ t('java.maxMemory') + ' ' + getExpectedSize(maxMemory, 'B') }}
              </strong>
            </template>
          </v-progress-linear>
          <v-range-slider
            v-if="instance.assignMemory !== false"
            v-model="mem"
            :input-value="mem"
            :disabled="instance.assignMemory !== true"
            :max="sysmem.total"
            min="0"
            :step="step"
            class="-mt-[25px] z-10"
            height="25"
            track-fill-color="transparent"
            track-color="transparent"
            color="red"
            hide-details
          >
            <template #thumb-label="{ value }">
              {{ getExpectedSize(value, '', 1) }}
            </template>
          </v-range-slider>
        </div>
      </div>
      <!-- t('java.noMemory') -->
    </v-list-item>
    <v-list-item style="margin-top: 5px">
      <v-list-item-content>
        <v-list-item-title>{{ t("instance.vmOptions") }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="instance.vmOptions"
            class="m-1 mt-2"
            hide-details
            required
            solo
            :placeholder="t('instance.vmOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import { BaseServiceKey, JavaRecord } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { useJava } from '../composables/java'
import JavaList from './BaseSettingJavaList.vue'
import { useI18n, useService } from '/@/composables'
import { injection } from '/@/util/inject'
import { getExpectedSize } from '/@/util/size'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { all: javas, add, remove: removeJava, refreshLocalJava, refreshing: refreshingLocalJava } = useJava()
const { data: instance } = injection(InstanceEditInjectionKey)
const { getMemoryStatus } = useService(BaseServiceKey)

const java = computed({
  get: () => javas.value.find(v => v.path === instance.javaPath) || { path: '', valid: false, majorVersion: 0, version: '' },
  set: (v: JavaRecord | undefined) => {
    instance.javaPath = v?.path ?? ''
  },
})

const sysmem: Ref<{ total: number; free: number }> = ref({ total: 0, free: 0 })
const step = 1024 * 1024 * 512

const memoryProgress = computed(() => (sysmem.value.total - sysmem.value.free) / sysmem.value.total * 100)
const memoryMode = computed({
  get() {
    if (instance.assignMemory === 'auto') return 1
    return instance.assignMemory ? 2 : 0
  },
  set(v: number) {
    if (v === 0) {
      instance.assignMemory = false
    } else if (v === 1) {
      instance.assignMemory = 'auto'
    } else {
      instance.assignMemory = true
    }
  },
})
const minMemory = computed(() => instance.assignMemory === 'auto' ? (sysmem.value.free - 512 * 1024 * 1024) : instance.minMemory * 1024 * 1024)
const maxMemory = computed(() => instance.assignMemory === 'auto' ? sysmem.value.total : instance.maxMemory * 1024 * 1024)

watch(maxMemory, (m) => {
  console.log(`max ${m}`)
})

const mem = computed({
  get(): [number, number] {
    return [minMemory.value, maxMemory.value]
  },
  set(mem: [number, number]) {
    if (!instance.loading) {
      instance.minMemory = mem[0] / 1024 / 1024
      instance.maxMemory = mem[1] / 1024 / 1024
    }
  },
})

const minMemoryProgress = computed(() => (minMemory.value) / (sysmem.value.total || 1) * 100)
const maxMemoryProgress = computed(() => (maxMemory.value) / (sysmem.value.total || 1) * 100)

async function browseFile() {
  const { filePaths } = await showOpenDialog({
    title: t('java.importFromFile'),
  })
  filePaths.forEach(add)
}

const updateTotalMemory = () => {
  getMemoryStatus().then(({ total, free }) => {
    sysmem.value.total = total
    sysmem.value.free = free
  })
}

let interval: any

onUnmounted(() => {
  clearInterval(interval)
})
onMounted(() => {
  updateTotalMemory()
  interval = setInterval(updateTotalMemory, 1000)
})

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
