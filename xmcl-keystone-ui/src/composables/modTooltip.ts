import { CompatibleDetail } from '@/util/modCompatible'
import { InjectionKey } from 'vue'

export function useModTooltip() {
  const currentTooltip = ref('')
  const x = ref(0)
  const y = ref(0)
  const isShown = ref(false)
  const onEnter = async (e: MouseEvent, dep: CompatibleDetail) => {
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    x.value = rect.x + rect.width / 2
    y.value = rect.y - 0
    currentTooltip.value = getCompatibleTooltip(dep)
    isShown.value = true
  }
  const onLeave = async (e: MouseEvent) => {
    isShown.value = false
  }
  const { t } = useI18n()

  const getCompatibleTooltip = (dep: CompatibleDetail) => {
    const compatibleText = dep.compatible === 'maybe'
      ? t('mod.maybeCompatible')
      : dep.compatible
        ? t('mod.compatible')
        : t('mod.incompatible')
    return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
  }

  return {
    currentTooltip,
    x,
    y,
    isShown,
    onEnter,
    onLeave,
  }
}

export const kModTooltip: InjectionKey<ReturnType<typeof useModTooltip>> = Symbol('ModTooltip')
