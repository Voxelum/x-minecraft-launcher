import { CompatibleDetail } from '@/util/modCompatible'

export function useModCompatibleTooltip() {
  const { t } = useI18n()
  const getTooltip = (dep: CompatibleDetail) => {
    const compatibleText = dep.compatible === 'maybe'
      ? t('mod.maybeCompatible')
      : dep.compatible
        ? t('mod.compatible')
        : t('mod.incompatible')
    return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
  }
  return { getTooltip }
}
