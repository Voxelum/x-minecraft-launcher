import { deserialize, serialize } from '@/util/theme.v1'
import { InstanceThemeServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { UIThemeDataV1 } from './theme'

export const kInstanceTheme: InjectionKey<ReturnType<typeof useInstanceTheme>> = Symbol('InstanceTheme')

/**
 * Use instance-level theme data
 */
export function useInstanceTheme(instancePath: Ref<string>) {
  const { getInstanceTheme, setInstanceTheme, getInstanceCustomCss, setInstanceCustomCss } = useService(InstanceThemeServiceKey)

  const instanceTheme = ref<UIThemeDataV1 | undefined>(undefined)
  /** The instance's custom CSS content. Empty when there is no instance theme. */
  const customCss = ref('')
  const loading = ref(false)

  async function loadTheme() {
    if (!instancePath.value) return
    loading.value = true
    try {
      const theme = await getInstanceTheme(instancePath.value)
      if (!theme) {
        instanceTheme.value = undefined
        customCss.value = ''
        return
      }
      instanceTheme.value = deserialize(theme)
      customCss.value = await getInstanceCustomCss(instancePath.value).catch(() => '')
    } finally {
      loading.value = false
    }
  }

  /** Write the instance's custom CSS content. */
  async function setCustomCss(css: string) {
    if (!instancePath.value) return
    await setInstanceCustomCss(instancePath.value, css)
    customCss.value = css
  }

  async function saveTheme() {
    if (!instancePath.value) return
    const theme = instanceTheme.value
    const themeData = theme ? serialize(theme) : undefined
    // `themeData` is built from the reactive `instanceTheme.value`, so it
    // contains nested Vue reactive proxies. Electron's IPC uses
    // `structuredClone` under the hood and throws
    // `An object could not be cloned.` on those proxies (issue #1430). The
    // payload is plain JSON-shaped (`ThemeData`), so a round-trip through
    // `JSON.parse(JSON.stringify(...))` cheaply deep-unwraps without
    // affecting semantics.
    const cloneable = themeData ? JSON.parse(JSON.stringify(themeData)) : undefined
    await setInstanceTheme(instancePath.value, cloneable)
    instanceTheme.value = theme
  }

  function clearTheme() {
    instanceTheme.value = undefined
    customCss.value = ''
    setInstanceTheme(instancePath.value, undefined)
    setInstanceCustomCss(instancePath.value, '').catch(() => undefined)
  }

  watch(() => instancePath.value, () => {
    loadTheme()
  }, { immediate: true })

  return {
    instanceTheme,
    customCss,
    loading,
    loadTheme,
    saveTheme,
    setCustomCss,
    clearTheme,
  }
}
