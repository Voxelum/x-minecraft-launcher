import { ThemeServiceKey } from '@xmcl/runtime-api'
import { useStyleTag } from '@vueuse/core'
import { InjectionKey, Ref, computed, onMounted, ref } from 'vue'
import { useService } from './service'
import type { UIThemeDataV1 } from './theme'

export const kCustomCss: InjectionKey<ReturnType<typeof useCustomCss>> = Symbol('CustomCss')

export interface CustomCssDeps {
  /** The global theme. Its `customCssEnabled` flag gates the global CSS. */
  currentTheme: Ref<UIThemeDataV1>
  /** The active instance theme, if any (overrides the global theme). */
  instanceTheme: Ref<UIThemeDataV1 | undefined>
  /** The active instance theme's custom CSS content. */
  instanceCss: Ref<string>
  /** Whether the instance theme override is suppressed (so global applies). */
  suppressed: Ref<boolean>
}

/**
 * Resolves and injects the *effective* custom CSS: the active instance theme's
 * CSS when an instance theme is in effect, otherwise the global theme's CSS.
 * Each is only applied while its own `customCssEnabled` flag is on.
 *
 * Also exposes the global CSS content + saver, which the global CSS editor and
 * the CSS agent edit directly.
 */
export function useCustomCss(deps: CustomCssDeps) {
  const service = useService(ThemeServiceKey)
  const { getCustomCss, setCustomCss } = service

  // Global custom CSS content (kept in sync with ThemeService).
  const css = ref('')
  const loading = ref(true)

  async function refresh() {
    try {
      css.value = await getCustomCss()
    } catch (e) {
      console.error('Failed to load custom CSS', e)
    } finally {
      loading.value = false
    }
  }

  refresh()

  onMounted(() => {
    service.on('custom-css-changed', (content: string) => {
      css.value = content
    })
  })

  // The instance theme overrides the global theme when present and not suppressed.
  const instanceActive = computed(() => !!deps.instanceTheme.value && !deps.suppressed.value)

  const effectiveEnabled = computed(() => (instanceActive.value
    ? !!deps.instanceTheme.value?.customCssEnabled
    : !!deps.currentTheme.value.customCssEnabled))

  const effectiveCss = computed(() => {
    if (!effectiveEnabled.value) return ''
    return instanceActive.value ? deps.instanceCss.value : css.value
  })

  useStyleTag(effectiveCss, {
    immediate: true,
    id: 'xmcl-custom-css',
  })

  // Custom background video URL declared via the --custom-background-video variable.
  const customBackgroundVideo = computed(() => {
    if (!effectiveEnabled.value) return ''
    const source = instanceActive.value ? deps.instanceCss.value : css.value
    const match = source.match(/--custom-background-video\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/)
    return match ? match[1].trim() : ''
  })

  async function save(content: string) {
    css.value = content
    await setCustomCss(content)
  }

  return {
    css,
    loading,
    refresh,
    save,
    customBackgroundVideo,
  }
}
