<template>
  <v-dialog
    :value="value"
    transition="fade-transition"
    width="700"
    @input="$emit('input', $event)"
  >
    <v-card
      rounded
      outlined
      class="visible-scroll max-h-[90vh] overflow-auto flex flex-col"
    >
      <v-progress-linear
        class="absolute left-0 top-0 z-20 m-0 p-0"
        :active="loading"
        height="3"
        :indeterminate="true"
      />
      <div
        v-if="selectedDetail"
      >
        <v-btn
          text
          large
          @click="selectedDetail = undefined"
        >
          <v-icon>
            arrow_back
          </v-icon>
        </v-btn>
      </div>
      <div
        v-else
        class="mx-5 mt-3 grid flex-grow-0 grid-cols-3 gap-5"
      >
        <v-select
          v-model="gameVersion"
          clearable
          :disabled="loading"
          hide-details
          flat
          solo
          :items="gameVersions"
          dense
          :label="t('modrinth.gameVersions.name')"
        />
        <v-select
          v-model="loader"
          clearable
          :disabled="loading"
          hide-details
          flat
          solo
          :items="loaders"
          dense
          :label="t('modrinth.modLoaders.name')"
        />
        <v-select
          v-model="versionType"
          clearable
          :disabled="loading"
          hide-details
          flat
          solo
          :items="versionTypes"
          dense
          :label="t('versionType.name')"
        />
      </div>

      <StoreProjectInstallVersionDialogVersion
        v-if="selectedDetail"
        class="min-h-22"
        :version="selectedDetail.version"
        no-click
      >
        <v-list-item-action>
          <v-btn
            color="primary"
            @click="emit('install', selectedDetail.version)"
          >
            <v-icon
              class="material-icons-outlined"
            >
              file_download
            </v-icon>
            {{ t('install') }}
          </v-btn>
        </v-list-item-action>
      </StoreProjectInstallVersionDialogVersion>

      <div
        ref="scrollElement"
        class="overflow-auto"
      >
        <div
          v-if="selectedDetail && selectedDetail.changelog"
          class="z-1 markdown-body m-2 hover:(bg-[rgba(0,0,0,0.05)]) dark:hover:(bg-[rgba(0,0,0,0.3)]) overflow-auto rounded-lg bg-[rgba(0,0,0,0.07)] py-2 pl-2 text-gray-500 transition-colors hover:text-black dark:bg-[rgba(0,0,0,0.4)] dark:hover:text-gray-300"
          v-html="render(selectedDetail.changelog)"
        />
        <v-divider
          v-if="selectedDetail"
          class="z-1"
        />
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
            <template v-if="selectedDetail">
              <v-list-item
                :href="selectedDetail.dependencies[row.index].href"
              >
                <v-list-item-avatar>
                  <img :src="selectedDetail.dependencies[row.index].icon">
                </v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title v-text="selectedDetail.dependencies[row.index].title" />
                  <v-list-item-subtitle v-text="selectedDetail.dependencies[row.index].title" />
                </v-list-item-content>
              </v-list-item>
            </template>
            <template v-else>
              <template v-if="typeof all[row.index] === 'string'">
                <v-subheader>
                  <v-divider class="mx-4" />
                  {{ t('modrinth.featuredVersions') }}
                  <v-divider class="mx-4" />
                </v-subheader>
              </template>
              <StoreProjectInstallVersionDialogVersion
                v-else
                :disabled="loading"
                :version="asAny(all[row.index])"
                @click="onVersionClicked(asAny(all[row.index]))"
              />
            </template>
          </div>
        </v-list>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useMarkdown } from '@/composables/markdown'
import { useVuetifyColor } from '@/composables/vuetify'
import { useVirtualizer, VirtualItem, VirtualizerOptions } from '@tanstack/vue-virtual'
import { VueInstance } from '@vueuse/core'
import StoreProjectInstallVersionDialogVersion from './StoreProjectInstallVersionDialogVersion.vue'

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
  value: boolean
}>()

const { t } = useI18n()

const emit = defineEmits(['install', 'input'])
const { getColorCode } = useVuetifyColor()

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

function getKey(i: number) {
  const v = all.value[i]
  if (!v) return i
  return typeof v === 'string' ? v : v.id
}

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

  return [...result, 'divider', ...originals.filter(v => !result.includes(v))]
})

const offsetTop = ref(0)

const containerRef = ref<HTMLElement | VueInstance | null>(null)
const scrollElement = ref<VueInstance | HTMLElement | null>(null)

watch(containerRef, container => {
  if (container) {
    nextTick().then(() => { offsetTop.value = getEl(container)?.offsetTop || 0 })
  }
})

const selectedDetail = ref<StoreProjectVersionDetail | undefined>(undefined)

const virtualizerOptions = computed(() => ({
  count: selectedDetail.value ? selectedDetail.value.dependencies.length : all.value.length,
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

const loading = ref(false)

async function onVersionClicked(version: StoreProjectVersion) {
  try {
    loading.value = true
    const detail = await props.getVersionDetail(version)
    selectedDetail.value = detail
  } finally {
    loading.value = false
  }
}

function getEl(e: any) {
  if (!e) return undefined
  if ('$el' in e) return e.$el as HTMLElement
  return e as HTMLElement
}

function asAny(v: unknown): any {
  return v as any
}

watch(selectedDetail, () => {
  nextTick().then(() => {
    const el = getEl(containerRef.value)
    if (el) {
      virtualizer.value.scrollToIndex(0)
      const top = el.offsetTop || 0
      offsetTop.value = 0
    }
  })
})

watch(() => props.value, (newVal) => {
  if (!newVal) {
    selectedDetail.value = undefined
  }
})
const { render } = useMarkdown()

</script>
