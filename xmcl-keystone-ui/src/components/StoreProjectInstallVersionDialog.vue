<template>
  <v-dialog
    :model-value="modelValue"
    data-testid="install-version-dialog"
    transition="fade-transition"
    width="760"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="visible-scroll flex max-h-[90vh] flex-col overflow-hidden select-none">
      <v-progress-linear
        class="absolute left-0 top-0 z-20 m-0 p-0"
        :active="loading"
        height="3"
        :indeterminate="true"
        color="primary"
      />

      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <v-btn
            v-if="!noBack && selectedDetail"
            icon="arrow_back"
            variant="text"
            size="small"
            @click="selectedDetail = undefined"
          />
          <div
            v-else
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">download</v-icon>
          </div>
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            {{ selectedDetail ? selectedDetail.version.name : t('shared.install') }}
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <div
        v-if="!selectedDetail"
        class="grid flex-grow-0 grid-cols-3 gap-3 px-5 pb-2 pt-4"
      >
        <v-select
          v-model="gameVersion"
          clearable
          :disabled="loading"
          hide-details
          variant="outlined"
          density="compact"
          prepend-inner-icon="sports_esports"
          :items="gameVersions"
          :label="t('modrinth.gameVersions.name')"
        />
        <v-select
          v-model="loader"
          clearable
          :disabled="loading"
          hide-details
          variant="outlined"
          density="compact"
          prepend-inner-icon="extension"
          :items="loaders"
          :label="t('modrinth.modLoaders.name')"
        />
        <v-select
          v-model="versionType"
          clearable
          :disabled="loading"
          hide-details
          variant="outlined"
          density="compact"
          prepend-inner-icon="label"
          :items="versionTypes"
          item-title="text"
          item-value="value"
          :label="t('versionType.name')"
        />
      </div>

      <template v-if="selectedDetail">
        <div class="flex items-center gap-3 px-5 py-3">
          <StoreProjectInstallVersionDialogVersion
            class="min-h-22 flex-1"
            :version="selectedDetail.version"
            no-click
          >
            <v-btn
              data-testid="install-version-confirm"
              color="primary"
              variant="flat"
              rounded="pill"
              size="large"
              prepend-icon="file_download"
              :loading="installing"
              @click="emit('install', selectedDetail.version)"
            >
              {{ t('shared.install') }}
            </v-btn>
          </StoreProjectInstallVersionDialogVersion>
        </div>

        <InstanceVersionShiftAlert
          v-if="!loading && initialSelectedDetail"
          class="mx-4 mb-2"
          :old-runtime="instance.runtime"
          :runtime="newRuntime"
        />
      </template>

      <div
        ref="scrollElement"
        class="flex-1 overflow-auto"
      >
        <div
          v-if="selectedDetail && selectedDetail.changelog"
          class="markdown-body z-1 mx-4 mb-2 mt-1 overflow-auto rounded-lg bg-[rgba(0,0,0,0.04)] p-3 text-sm dark:bg-[rgba(255,255,255,0.06)]"
          style="color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity, 0.95))"
          v-html="render(selectedDetail.changelog)"
        />

        <div
          v-if="selectedDetail && !loading && selectedDetail.dependencies.length > 0"
          class="text-caption mx-4 mt-2 flex items-center gap-2"
          style="color: rgba(var(--v-theme-on-surface), 0.85)"
        >
          <v-icon size="small">device_hub</v-icon>
          {{ t('dependencies.name') }}
          <span class="opacity-70">
            ({{ selectedDetail.dependencies.length }})
          </span>
        </div>

        <v-list
          ref="containerRef"
          class="overflow-auto"
          color="transparent"
          :style="{
            height: `${totalHeight}px`,
            position: 'relative',
            width: '100%',
            marginTop: `${-offsetTop}px`,
          }"
        >
          <div
            v-for="row of virtualRows"
            :key="getKey(row.index)"
            :ref="measureElement"
            :data-index="row.index"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`
            }"
          >
            <template v-if="loading">
              <v-skeleton-loader
                type="list-item-two-line, list-item-two-line"
              />
            </template>
            <template v-else-if="selectedDetail">
              <v-list-item
                class="mx-2 rounded-lg"
                :href="selectedDetail.dependencies[row.index].href"
                :title="selectedDetail.dependencies[row.index].title"
                :subtitle="selectedDetail.dependencies[row.index].description"
              >
                <template #prepend>
                  <v-avatar>
                    <img width="40" :src="selectedDetail.dependencies[row.index].icon">
                  </v-avatar>
                </template>
                <template #append>
                  <v-chip
                    size="x-small"
                    label
                    variant="tonal"
                    :color="getDepColor(selectedDetail.dependencies[row.index].dependencyType)"
                  >
                    {{ selectedDetail.dependencies[row.index].dependencyType }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
            <template v-else>
              <div
                v-if="typeof all[row.index] === 'string'"
                class="text-caption mx-4 mt-3 flex items-center gap-3 uppercase tracking-wider"
                style="color: rgba(var(--v-theme-on-surface), 0.7)"
              >
                <v-divider class="flex-1" />
                <span>{{ t('modrinth.featuredVersions') }}</span>
                <v-divider class="flex-1" />
              </div>
              <StoreProjectInstallVersionDialogVersion
                v-else
                class="mx-2"
                :disabled="loading"
                :version="asAny(all[row.index])"
                @click="onVersionClicked(asAny(all[row.index]))"
              />
            </template>
          </div>
        </v-list>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useMarkdown } from '@/composables/markdown'
import { useVirtualizer, VirtualItem, VirtualizerOptions } from '@tanstack/vue-virtual'
import { VueInstance } from '@vueuse/core'
import { getEl } from '@/util/el'
import StoreProjectInstallVersionDialogVersion from './StoreProjectInstallVersionDialogVersion.vue'
import InstanceVersionShiftAlert from './InstanceVersionShiftAlert.vue'
import { injection } from '@/util/inject'
import { kInstance } from '@/composables/instance'

export interface StoreProjectVersion {
  id: string
  name: string
  version_type: string
  game_versions: string[]
  loaders: string[]
}

export interface StoreProjectVersionDetail {
  version: StoreProjectVersion
  dependencies: Array<{
    title: string
    description: string
    icon: string
    href: string
    dependencyType: string | 'required' | 'optional' | 'incompatible' | 'embedded'
  }>
  changelog: string
}

const props = defineProps<{
  versions: StoreProjectVersion[]
  getVersionDetail: (version: StoreProjectVersion) => Promise<StoreProjectVersionDetail>
  modelValue: boolean
  initialSelectedDetail?: StoreProjectVersion
  noBack?: boolean
  installing?: boolean
}>()

const { t } = useI18n()

const emit = defineEmits(['install', 'update:modelValue'])

const gameVersions = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    for (const gv of v.game_versions) {
      if (!result.includes(gv)) result.push(gv)
    }
  }
  return result
})

const loaders = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    for (const gv of v.loaders) {
      if (!result.includes(gv)) result.push(gv)
    }
  }
  return result
})

const versionTypes = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    if (!result.includes(v.version_type)) result.push(v.version_type)
  }
  return result.map(v => ({ text: t(`versionType.${v}`), value: v }))
})

const gameVersion = ref('' as string)
const loader = ref('' as string)
const versionType = ref('' as string)

const all = computed(() => {
  const filtered = [] as StoreProjectVersion[]
  for (const v of props.versions) {
    if (gameVersion.value && !v.game_versions.includes(gameVersion.value)) continue
    if (loader.value && !v.loaders.includes(loader.value)) continue
    if (versionType.value && v.version_type !== versionType.value) continue
    filtered.push(v)
  }

  const originals = filtered
  const groupByGameVersionsByLoader = {} as Record<string, Record<string, StoreProjectVersion[]>>

  for (const v of originals) {
    const key = v.game_versions.join(' ')
    if (!groupByGameVersionsByLoader[key]) {
      groupByGameVersionsByLoader[key] = {}
    }
    const loaderKey = v.loaders.join(' ')
    if (!groupByGameVersionsByLoader[key][loaderKey]) {
      groupByGameVersionsByLoader[key][loaderKey] = []
    }

    groupByGameVersionsByLoader[key][loaderKey].push(v)
  }

  // Each game version, each loader should have a featured version
  // If has release use release as featured, otherwise use beta, otherwise use alpha
  const result = [] as StoreProjectVersion[]
  for (const key in groupByGameVersionsByLoader) {
    const versions = groupByGameVersionsByLoader[key]
    for (const loaderKey in versions) {
      const vers = versions[loaderKey]
      const release = vers.find(v => v.version_type === 'release')
      const beta = vers.find(v => v.version_type === 'beta')
      const alpha = vers.find(v => v.version_type === 'alpha')
      const ver = release || beta || alpha
      if (ver) result.push(ver)
    }
  }

  const otherVersions = originals.filter(v => !result.includes(v))

  if (otherVersions.length === 0) {
    return result
  }

  return [...result, 'divider', ...otherVersions]
})

// Select versions
const loading = ref(false)
const selectedDetail = shallowRef<StoreProjectVersionDetail | undefined>()
watch(() => props.initialSelectedDetail, (v) => {
  if (v) {
    onVersionClicked(v)
  } else {
    selectedDetail.value = undefined
  }
}, { immediate: true })
async function onVersionClicked(version: StoreProjectVersion) {
  try {
    selectedDetail.value = {
      version,
      dependencies: [],
      changelog: '',
    }
    loading.value = true
    const detail = await props.getVersionDetail(version)
    selectedDetail.value = detail
  } finally {
    loading.value = false
  }
}

const { instance } = injection(kInstance)
const newRuntime = computed(() => {
  if (!selectedDetail.value) return {}
  const v = selectedDetail.value
  if (v.version.loaders.includes('fabric')) {
    return { fabricLoader: 1 }
  }
  if (v.version.loaders.includes('forge')) {
    return { forge: 1 }
  }
  if (v.version.loaders.includes('quilt')) {
    return { quiltLoader: 1 }
  }
  if (v.version.loaders.includes('neoforge')) {
    return { neoForged: 1 }
  }
  return {}
})

function asAny(v: unknown): any {
  return v as any
}

function getDepColor(type: string) {
  switch (type) {
    case 'required': return 'error'
    case 'optional': return 'info'
    case 'incompatible': return 'warning'
    case 'embedded': return 'success'
    default: return 'grey'
  }
}

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    selectedDetail.value = undefined
  } else {
    if (props.initialSelectedDetail) {
      onVersionClicked(props.initialSelectedDetail)
    }
  }
})
const { render } = useMarkdown()

// virtual scroll
const offsetTop = ref(0)
const containerRef = ref<HTMLElement | VueInstance | null>(null)
const scrollElement = ref<VueInstance | HTMLElement | null>(null)

watch(containerRef, container => {
  if (container) {
    nextTick().then(() => { offsetTop.value = getEl(container)?.offsetTop || 0 })
  }
})

function getKey(i: number) {
  const v = all.value[i]
  if (!v) return i
  return typeof v === 'string' ? v : v.id
}

const virtualizerOptions = computed(() => ({
  count: selectedDetail.value ? (loading.value ? 4 : selectedDetail.value.dependencies.length) : all.value.length,
  getScrollElement: () => getEl(scrollElement.value)/* ?.$el */ as any,
  estimateSize: () => selectedDetail.value ? 62 : 79,
  overscan: 10,
  paddingStart: offsetTop.value,
} satisfies Partial<VirtualizerOptions<HTMLElement, HTMLElement>>))

const virtualizer = useVirtualizer(virtualizerOptions)
const totalHeight = computed(() => virtualizer.value.getTotalSize())
const virtualRows = computed(() => virtualizer.value.getVirtualItems() as (Omit<VirtualItem, 'key'> & { key: number })[])

const measureElement = (el: any) => {
  if (!el) return
  if ('$el' in el) {
    el = el.$el
  }
  virtualizer.value.measureElement(el)
}

watch(selectedDetail, () => {
  nextTick().then(() => {
    const el = getEl(containerRef.value)
    if (el) {
      virtualizer.value.scrollToIndex(0)
      offsetTop.value = 0
    }
  })
})

</script>
