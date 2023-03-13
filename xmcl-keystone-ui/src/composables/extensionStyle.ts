import { injection } from '@/util/inject'
import { kCompact } from './scrollTop'

export function useExtensionMarginBottom() {
  const compact = injection(kCompact)
  return {
    'mb-3': !compact.value,
    'mb-2': compact.value,
  }
}
