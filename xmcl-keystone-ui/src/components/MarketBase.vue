<template>
  <div
    class="relative flex h-full select-none flex-col overflow-auto pb-0"
    @wheel.stop
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-20 m-0 p-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <SplitPane
      flex-left
      :min-percent="30"
      :default-percent="30"
      class="flex h-full w-full overflow-auto py-0"
    >
      <template #left>
        <div
          class="flex flex-grow-0 items-center px-4"
        >
          <slot
            v-if="items.length > 0"
            name="actions"
          />
        </div>
        <v-virtual-scroll
          v-if="items.length > 0"
          id="left-pane"
          :bench="2"
          class="visible-scroll h-full max-h-full w-full overflow-auto"
          :items="items"
          :item-height="itemHeight"
          @scroll="onScroll"
        >
          <template #default="{ item }">
            <slot
              name="item"
              :item="item"
              :has-update="typeof item === 'string' ? false : !!plans[item.id]"
              :checked="typeof item === 'string' ? false : (selections[item.id] || false)"
              :selection-mode="typeof item === 'string' ? false : (selectionMode && item.installed && item.installed.length > 0)"
              :selected="typeof item === 'string' ? false : ((selectedItem && selectedItem.id === item.id) || false)"
              :on="{ click: () => onSelect(item) }"
            />
          </template>
        </v-virtual-scroll>
        <ErrorView
          v-if="error"
          :error="error"
        />
        <slot
          v-else-if="items.length === 0"
          name="placeholder"
        />
      </template>
      <template #right>
        <div
          id="right-pane"
          class="flex h-full flex-grow-0 overflow-y-auto overflow-x-hidden"
        >
          <slot
            name="content"
            :selected-item="selectedItem"
            :selected-id="selectedId"
            :selected-modrinth-id="selectedModrinthId"
            :selected-curseforge-id="selectedCurseforgeId"
            :updating="plans[selectedItem?.id ?? '']?.updating"
          />
        </div>
      </template>
    </SplitPane>
    <slot />
  </div>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import SplitPane from '@/components/SplitPane.vue'
import { UpgradePlan } from '@/composables/modUpgrade'
import { useQuery } from '@/composables/query'
import { ProjectEntry } from '@/util/search'

const props = defineProps<{
  plans: Record<string, UpgradePlan>
  items: (ProjectEntry | string)[]
  itemHeight: number
  loading?: boolean
  error?: any
}>()
const emit = defineEmits<{
  (event: 'load'): void
  (event: 'drop', e: DragEvent): void
}>()

const selectedId = useQuery('id')
const selectedItem = computed(() => {
  if (!selectedId.value) return undefined
  return props.items.find((i) => typeof i === 'object' && i.id === selectedId.value) as ProjectEntry | undefined
})

watch(() => props.items, (i, old) => {
  if (!old || old.length === 0) {
    if (i.length > 0) {
      selectedId.value = i[0].id
    }
  }
})

const selectedModrinthId = computed(() => {
  const id = selectedId.value
  if (id && id?.startsWith('modrinth:')) {
    return id.substring('modrinth:'.length)
  }
  return selectedItem.value?.modrinthProjectId || selectedItem.value?.modrinth?.project_id || ''
})
const selectedCurseforgeId = computed(() => {
  const id = selectedId.value
  if (id && id?.startsWith('curseforge:')) {
    return Number(id.substring('curseforge:'.length))
  }
  return selectedItem.value?.curseforgeProjectId || selectedItem.value?.curseforge?.id || undefined
})

const onSelect = (i: ProjectEntry) => {
  selectedId.value = i.id
}

const onScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
    emit('load')
  }
}

const selectionMode = ref(false)
const selections = ref({} as Record<string, boolean>)
const onKeyPress = (e: KeyboardEvent) => {
  // ctrl+a
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    e.stopPropagation()
    selectionMode.value = true

    const _selections: Record<string, boolean> = {}
    for (const item of props.items) {
      if (typeof item === 'string') continue
      if (item.installed.length > 0) {
        _selections[item.id] = true
      }
    }
    selections.value = _selections
  }
  // esc
  if (e.key === 'Escape') {
    selectionMode.value = false
    selections.value = {}
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeyPress)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyPress)
})

</script>

<style scoped>
.search-text {
  display: none;
}

@container (min-width: 260px) {
  .search-text {
    display: block;
  }
}

.responsive-header {
  container-type: size;
  width: 100%;
}
</style>
