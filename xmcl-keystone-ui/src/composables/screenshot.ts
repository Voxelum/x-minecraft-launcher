import {
  InstanceScreenshotServiceKey,
  InstanceThemeServiceKey,
  LaunchServiceKey,
  ScreenshotItem,
  ThemeServiceKey,
} from '@xmcl/runtime-api'
import { useService } from './service'
import { useRefreshable } from './refreshable'
import { computed, onUnmounted, shallowRef, watch, type Ref } from 'vue'

export function useInstanceScreenshots(path: Ref<string>) {
  const {
    getScreenshotItems,
    deleteScreenshot: deleteOne,
    deleteScreenshots: deleteMany,
    showScreenshot: showOne,
    importScreenshots: importMany,
    saveScreenshotAs: saveAs,
    setAsInstanceIcon: setIcon,
    saveEditedScreenshot: saveEditedMethod,
  } = useService(InstanceScreenshotServiceKey)
  const { on, removeListener } = useService(LaunchServiceKey)
  const { addMedia: addInstanceThemeMedia } = useService(InstanceThemeServiceKey)
  const { addMedia: addGlobalThemeMedia } = useService(ThemeServiceKey)

  const items = shallowRef<ScreenshotItem[]>([])
  const urls = computed(() => items.value.map((i) => i.url))

  const { refresh, refreshing } = useRefreshable(async () => {
    if (!path.value) {
      items.value = []
      return
    }
    const result = await getScreenshotItems(path.value)
    items.value = result || []
  })

  watch(path, () => { refresh() }, { immediate: true })
  const onExit = () => { refresh() }
  on('minecraft-exit', onExit)
  onUnmounted(() => {
    removeListener('minecraft-exit', onExit)
  })

  async function remove(url: string) {
    const success = await deleteOne(url)
    if (success) {
      items.value = items.value.filter((i) => i.url !== url)
    }
    return success
  }

  async function removeMany(urlsToDelete: string[]) {
    const set = new Set(urlsToDelete)
    const count = await deleteMany(urlsToDelete)
    if (count > 0) {
      items.value = items.value.filter((i) => !set.has(i.url))
    }
    return count
  }

  async function show(url: string) {
    await showOne(url)
  }

  async function importFiles(filePaths: string[]) {
    const added = await importMany(path.value, filePaths)
    if (added.length > 0) {
      await refresh()
    }
    return added
  }

  async function saveAsFile(url: string, targetPath: string, overwrite = false) {
    return saveAs(url, targetPath, overwrite)
  }

  async function setAsIcon(url: string) {
    await setIcon(path.value, url)
  }

  function copyImage(url: string) {
    windowController.writeClipboardImage(url)
  }

  async function setAsWallpaper(url: string, isInstance = true) {
    const parsed = new URL(url)
    const filePath = parsed.searchParams.get('path')
    if (!filePath) return
    if (isInstance && path.value) {
      await addInstanceThemeMedia(path.value, filePath)
    } else {
      await addGlobalThemeMedia(filePath)
    }
  }

  async function saveEdited(dataUrl: string, originalUrl?: string, saveAsCopy = false) {
    const saved = await saveEditedMethod({
      instancePath: path.value,
      dataUrl,
      originalUrl,
      saveAsCopy,
    })
    await refresh()
    return saved
  }

  return {
    items,
    urls,
    refresh,
    refreshing,
    remove,
    removeMany,
    show,
    importFiles,
    saveAsFile,
    setAsIcon,
    copyImage,
    setAsWallpaper,
    saveEdited,
  }
}

