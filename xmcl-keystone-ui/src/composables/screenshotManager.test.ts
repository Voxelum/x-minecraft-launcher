import { nextTick, ref } from 'vue'
import { expect, test, vi } from 'vitest'
vi.mock('./screenshot', async () => {
  const { ref } = await import('vue')
  return { useInstanceScreenshots: () => ({ items: ref([
    { name: 'first.png', url: 'first', size: 1, createdAt: 1 },
    { name: 'second.png', url: 'second', size: 1, createdAt: 2 },
  ]) }) }
})
import { useScreenshotManager } from './screenshotManager'

test('clearable search accepts null and restores the entire gallery', () => {
  const manager = useScreenshotManager(ref('instance'))
  manager.search.value = 'first'
  expect(manager.filteredItems.value).toHaveLength(1)
  manager.search.value = null
  expect(manager.filteredItems.value).toHaveLength(2)
})

test('changing instances clears old destructive selections and preview state', async () => {
  const path = ref('first-instance')
  const manager = useScreenshotManager(path)
  manager.toggleSelect('first')
  manager.openPreview(1)
  path.value = 'second-instance'
  await nextTick()
  expect(manager.selectedUrls.value.size).toBe(0)
  expect(manager.isPreviewOpen.value).toBe(false)
  expect(manager.activePreviewIndex.value).toBe(0)
})
