<template>
  <div class="upstream-base mx-2 grid grid-cols-9 gap-6 pb-4">
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
        <div
          v-if="row.index === 0"
          :key="'currentVersion' + row.index"
          :ref="measureElement"
          class="upstream-base__section-header"
          :data-index="row.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`,
          }"
        >
          <span class="upstream-base__section-title">
            {{ t('modrinthCard.currentVersion') }}
          </span>
          <div class="flex-grow" />
          <v-switch
            v-model="_only"
            density="compact"
            color="primary"
            hide-details
            :label="t('upstream.onlyShowCurrentVersion')"
            class="upstream-base__filter-switch"
          />
        </div>
        <div
          v-else-if="isHeader(row.index)"
          :ref="measureElement"
          :key="getHeader(row.index)"
          class="upstream-base__section-header upstream-base__section-header--date"
          :data-index="row.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`,
          }"
        >
          <v-icon size="14" class="material-icons-outlined opacity-60">event</v-icon>
          <span class="upstream-base__section-title">
            {{ getHeader(row.index) }}
          </span>
          <div class="upstream-base__section-rule" />
        </div>
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
            v-if="!loading"
            :version="getItemVersion(row.index)"
            :updating="updating"
            :duplicating="duplicating"
            :outlined="true"
            :no-action="row.index === 1 || currentVersion?.id === getItemVersion(row.index).id"
            :downgrade="isItemDowngrade(row.index)"
            @changelog="$emit('changelog', getItemVersion(row.index))"
            @update="$emit('update', getItemVersion(row.index))"
            @duplicate="$emit('duplicate', getItemVersion(row.index))"
          />
          <v-skeleton-loader
            v-else
            type="table-heading, list-item-two-line, table-tfoot"
          />
        </div>
      </template>
    </div>

    <div
      v-if="header"
      class="lg:(col-span-3 row-start-auto) col-span-9 row-start-1"
    >
      <div class="upstream-base__sidebar">
        <HomeUpstreamHeader
          :value="header"
        />
      </div>
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
  loading?: boolean
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
  count: props.loading ? 10 : listItems.value.length,
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
  if (!item) {
    return '-1'
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

<style scoped>
.upstream-base__sidebar {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upstream-base__section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 4px;
}

.upstream-base__section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  white-space: nowrap;
}

.upstream-base__section-header--date {
  margin-top: 8px;
}

.upstream-base__section-header--date .upstream-base__section-title {
  text-transform: none;
  letter-spacing: 0.02em;
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.8;
}

.upstream-base__section-rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    to right,
    rgba(128, 128, 128, 0.25),
    rgba(128, 128, 128, 0)
  );
}

.upstream-base__filter-switch :deep(.v-label) {
  font-size: 0.75rem;
  opacity: 0.75;
}
</style>
