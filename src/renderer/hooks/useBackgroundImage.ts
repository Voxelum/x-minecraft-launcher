import { computed } from '@vue/composition-api'
import { useLocalStorageCacheInt } from './useCache'

export function useBackgroundImage () {
  const blur = useLocalStorageCacheInt('blur', 0)
  const backgroundImage = computed(() => null)
  return {
    blur,
    backgroundImage,
  }
}
