<template>
  <div class="mx-2 grid grid-cols-9 gap-6 pb-4">
    <div
      ref="containerRef"
      class="col-span-9 lg:col-span-6"
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
        width: '100%',
        marginTop: `${-offsetTop}px`,
      }"
    >
      <template
        v-for="row of virtualizer.getVirtualItems()"
      >
        <v-subheader
          v-if="row.index === 0"
          :key="'currentVersion' + row.index"
          :ref="measureElement"
          class="flex"
          :data-index="row.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`
          }"
        >
          {{ t('modrinthCard.currentVersion') }}
          <div class="flex-grow" />
          <v-switch
            v-model="_only"
            dense
            :label="t('upstream.onlyShowCurrentVersion')"
          />
        </v-subheader>
        <v-subheader
          v-else-if="isHeader(row.index)"
          :ref="measureElement"
          :key="getHeader(row.index)"
          class="text-md"
          :data-index="row.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`
          }"
        >
          {{ getHeader(row.index) }}
        </v-subheader>
        <div
          v-else
          :ref="measureElement"
          :key="getItemKey(row.index)"
          :data-index="row.index"
          :style="{
            position: 'absolute',
            top: 0,
            paddingTop: getItemPaddingTop(row.index),
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`
          }"
        >
          <HomeUpstreamVersion
            :version="getItemVersion(row.index)"
            :updating="updating"
            :duplicating="duplicating"
            :outlined="row.index === 1"
            :no-action="row.index === 1 || currentVersion?.id === getItemVersion(row.index).id"
            :downgrade="isItemDowngrade(row.index)"
            @changelog="$emit('changelog', getItemVersion(row.index))"
            @update="$emit('update', getItemVersion(row.index))"
            @duplicate="$emit('duplicate', getItemVersion(row.index))"
          />
        </div>
      </template>
    </div>

    <div
      v-if="header"
      class="lg:(col-span-3 row-start-auto) col-span-9 row-start-1"
    >
      <v-subheader class="px-1">
        {{ header?.type === 'modrinth' ? 'Modrinth' : header?.type === 'curseforge' ? 'Curseforge' : 'FTB' }}
      </v-subheader>
      <HomeUpstreamHeader
        :value="header"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import HomeUpstreamHeader, { UpstreamHeaderProps } from './HomeUpstreamHeader.vue'
import HomeUpstreamVersion, { ProjectVersionProps } from './HomeUpstreamVersion.vue'
import { useVirtualizer, VirtualizerOptions } from '@tanstack/vue-virtual'
import { getEl } from '@/util/el'

const props = defineProps<{
  duplicating?: boolean
  updating?: boolean
  items: Record<string, ProjectVersionProps[]>
  currentVersion?: ProjectVersionProps
  header?: UpstreamHeaderProps
  onlyCurrentVersion?: boolean
}>()

const emit = defineEmits(['update', 'duplicate', 'changelog', 'update:onlyCurrentVersion'])

const { t } = useI18n()
const _only = useVModel(props, 'onlyCurrentVersion', emit)
const isDowngrade = (current: string, target: string) => {
  const da = new Date(current)
  const db = new Date(target)
  return da > db
}

// virtual scroll
const listItems = computed(() => {
  if (!props.currentVersion) {
    return []
  }
  const items = props.items
  const results = [
    '',
    props.currentVersion,
  ] as (ProjectVersionProps | string)[]
  for (const [date, versions] of Object.entries(items)) {
    results.push(date)
    results.push(...versions.filter(v => !!v))
  }
  return results
})
const scrollElement = inject('scrollElement', ref(null as HTMLElement | null))
const offsetTop = ref(0)
const containerRef = ref(null as HTMLElement | null)
const virtualizerOptions = computed(() => ({
  count: Object.keys(props.items).length,
  getScrollElement: () => getEl(scrollElement.value) as any,
  paddingStart: offsetTop.value,
  overscan: 5,
  estimateSize,
} satisfies Partial<VirtualizerOptions<HTMLElement, HTMLElement>>))

watch(containerRef, container => {
  if (container) {
    nextTick().then(() => { offsetTop.value = container.offsetTop })
  }
})
const virtualizer = useVirtualizer(virtualizerOptions)

function estimateSize(i: number) {
  if (typeof listItems.value[i] === 'string') {
    return 48
  }
  const item = listItems.value[i] as ProjectVersionProps
  if (!item) {
    return 48
  }
  const changelogHtml = item.changelog
  // estimate the height of the changelog by counting how many div and li inside
  const divCount = (changelogHtml.match(/<div/g) || []).length
  const liCount = (changelogHtml.match(/<li/g) || []).length
  return Math.min(650, 48 + divCount * 24 + liCount * 24)
}
function isHeader(index: number) {
  return typeof listItems.value[index] === 'string'
}
function getHeader(index: number) {
  return listItems.value[index] as string
}
function getItemKey(index: number) {
  const item = listItems.value[index]
  if (typeof item === 'string') {
    return item + _only.value
  }
  return item.id + _only.value
}
function getItemPaddingTop(index: number) {
  if (typeof listItems.value[index - 1] !== 'string') {
    return '0.5rem'
  }
  return ''
}
function getItemVersion(index: number) {
  const item = listItems.value[index]
  if (typeof item === 'string') {
    throw new Error()
  }
  return item
}
function isItemDowngrade(index: number) {
  const item = listItems.value[index]
  if (typeof item === 'string') {
    return false
  }
  return isDowngrade(props.currentVersion?.datePublished ?? '', item.datePublished)
}
const measureElement = (el: any) => {
  if (!el) return
  if ('$el' in el) {
    el = el.$el
  }
  virtualizer.value.measureElement(el)
}
watch(_only, () => {
  virtualizer.value.scrollToIndex(0)
  offsetTop.value = 0
})
</script>
