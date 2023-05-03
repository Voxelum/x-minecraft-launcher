import { CompatibleDetail } from '@/util/modCompatible'

export const getCompatibleIcon = (c?: CompatibleDetail) => {
  if (!c) return '❔'
  if (c.compatible === 'maybe') return '❔'
  return c.compatible ? '✔️' : '❌'
}
