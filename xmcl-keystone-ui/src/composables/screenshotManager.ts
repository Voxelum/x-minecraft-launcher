import { InjectionKey, Ref, computed, inject, ref, watch } from 'vue'
import { ScreenshotItem } from '@xmcl/runtime-api'
import { useInstanceScreenshots } from './screenshot'
import { injection } from '@/util/inject'

export type ScreenshotSortOption = 'dateDesc' | 'dateAsc' | 'sizeDesc' | 'sizeAsc' | 'nameAsc' | 'nameDesc'
export type ScreenshotViewMode = 'grid' | 'gridCompact' | 'list'

export function useScreenshotManager(instancePath: Ref<string>) {
  const screenshots = useInstanceScreenshots(instancePath)

  const search = ref<string | null>('')
  const sort = ref<ScreenshotSortOption>('dateDesc')
  const viewMode = ref<ScreenshotViewMode>('grid')
  const selectedUrls = ref(new Set<string>())
  const activePreviewIndex = ref(0)
  const isPreviewOpen = ref(false)

  const totalSize = computed(() =>
    screenshots.items.value.reduce((acc, cur) => acc + (cur.size || 0), 0)
  )

  const filteredItems = computed(() => {
    let result = [...screenshots.items.value]
    const q = (search.value ?? '').trim().toLowerCase()
    if (q) {
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q)
      )
    }

    switch (sort.value) {
      case 'dateDesc':
        result.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'dateAsc':
        result.sort((a, b) => a.createdAt - b.createdAt)
        break
      case 'sizeDesc':
        result.sort((a, b) => b.size - a.size)
        break
      case 'sizeAsc':
        result.sort((a, b) => a.size - b.size)
        break
      case 'nameAsc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'nameDesc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
    }
    return result
  })

  function toggleSelect(url: string) {
    const next = new Set(selectedUrls.value)
    if (next.has(url)) next.delete(url)
    else next.add(url)
    selectedUrls.value = next
  }

  function selectAll() {
    selectedUrls.value = new Set(filteredItems.value.map((i) => i.url))
  }

  function clearSelection() {
    selectedUrls.value = new Set()
  }

  watch(instancePath, () => {
    clearSelection()
    isPreviewOpen.value = false
    activePreviewIndex.value = 0
  })

  function openPreview(index: number) {
    activePreviewIndex.value = index
    isPreviewOpen.value = true
  }

  function closePreview() {
    isPreviewOpen.value = false
  }

  return {
    ...screenshots,
    search,
    sort,
    viewMode,
    selectedUrls,
    activePreviewIndex,
    isPreviewOpen,
    totalSize,
    filteredItems,
    toggleSelect,
    selectAll,
    clearSelection,
    openPreview,
    closePreview,
  }
}

export type ScreenshotManagerContext = ReturnType<typeof useScreenshotManager>
export const kScreenshotManager: InjectionKey<ScreenshotManagerContext> = Symbol('ScreenshotManager')

export function useScreenshotManagerContext(): ScreenshotManagerContext {
  return injection(kScreenshotManager)
}
