import { CustomCssEntry, CustomCssServiceKey, CustomCssState } from '@xmcl/runtime-api'
import { useStyleTag } from '@vueuse/core'
import { computed, InjectionKey, ref, Ref, watch } from 'vue'
import { useService } from './service'

export const kCustomCss: InjectionKey<ReturnType<typeof useCustomCss>> = Symbol('CustomCss')

export function useCustomCss() {
  const {
    getCustomCssState,
    addCustomCssFromText,
    addCustomCssFromFile,
    addCustomCssFromZip,
    updateCustomCssEntry,
    removeCustomCssEntry,
    exportCustomCssToFile,
    setGlobalCustomCssEnabled,
  } = useService(CustomCssServiceKey)

  const globalEnabled = ref(false)
  const entries: Ref<CustomCssEntry[]> = ref([])
  const loading = ref(true)

  async function refresh() {
    try {
      const state: CustomCssState = await getCustomCssState()
      globalEnabled.value = state.globalEnabled
      entries.value = state.entries
    } catch (e) {
      console.error('Failed to load custom CSS state', e)
    } finally {
      loading.value = false
    }
  }

  refresh()

  // Compute the combined CSS string from all enabled entries
  const combinedCss = computed(() => {
    if (!globalEnabled.value) return ''
    return entries.value
      .filter(e => e.enabled)
      .map(e => `/* [Custom CSS: ${e.name}] */\n${e.css}`)
      .join('\n\n')
  })

  // Compute custom background video URL if defined via --custom-background-video CSS variable
  const customBackgroundVideo = computed(() => {
    if (!globalEnabled.value) return ''
    const match = combinedCss.value.match(/--custom-background-video\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/)
    return match ? match[1].trim() : ''
  })

  // Inject the combined CSS into the DOM
  useStyleTag(combinedCss, {
    immediate: true,
    id: 'xmcl-custom-css',
  })

  async function toggleGlobal(enabled: boolean) {
    globalEnabled.value = enabled
    await setGlobalCustomCssEnabled(enabled)
  }

  async function addFromText(name: string, css: string) {
    const entry = await addCustomCssFromText(name, css)
    entries.value = [...entries.value, entry]
    return entry
  }

  async function addFromFile(filePath: string) {
    const entry = await addCustomCssFromFile(filePath)
    entries.value = [...entries.value, entry]
    return entry
  }

  async function addFromZip(filePath: string) {
    const newEntries = await addCustomCssFromZip(filePath)
    entries.value = [...entries.value, ...newEntries]
    return newEntries
  }

  async function updateEntry(id: string, patch: Partial<Pick<CustomCssEntry, 'name' | 'css' | 'enabled'>>) {
    const updated = await updateCustomCssEntry(id, patch)
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx !== -1) {
      const newEntries = [...entries.value]
      newEntries[idx] = updated
      entries.value = newEntries
    }
    return updated
  }

  async function removeEntry(id: string) {
    await removeCustomCssEntry(id)
    entries.value = entries.value.filter(e => e.id !== id)
  }

  return {
    globalEnabled,
    entries,
    loading,
    refresh,
    toggleGlobal,
    addFromText,
    addFromFile,
    addFromZip,
    updateEntry,
    removeEntry,
    customBackgroundVideo,
    exportEntry: (id: string, filePath: string) => exportCustomCssToFile(id, filePath),
  }
}
