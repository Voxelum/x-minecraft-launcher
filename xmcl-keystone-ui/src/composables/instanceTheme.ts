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
  const { getInstanceTheme, setInstanceTheme } = useService(InstanceThemeServiceKey)

  const instanceTheme = ref<UIThemeDataV1 | undefined>(undefined)
  const loading = ref(false)

  async function loadTheme() {
    if (!instancePath.value) return
    loading.value = true
    try {
      const theme = await getInstanceTheme(instancePath.value)
      if (!theme) {
        instanceTheme.value = undefined
        return
      }
      instanceTheme.value = deserialize(theme)
    } finally {
      loading.value = false
    }
  }

  async function saveTheme() {
    if (!instancePath.value) return
    const theme = instanceTheme.value
    const themeData = theme ? serialize(theme) : undefined
    await setInstanceTheme(instancePath.value, themeData)
    instanceTheme.value = theme
  }

  function clearTheme() {
    instanceTheme.value = undefined
    setInstanceTheme(instancePath.value, undefined)
  }

  watch(() => instancePath.value, () => {
    loadTheme()
  }, { immediate: true })

  return {
    instanceTheme,
    loading,
    loadTheme,
    saveTheme,
    clearTheme,
  }
}
