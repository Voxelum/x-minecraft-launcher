import { PresenceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useService } from './service'

export function usePresence(activity: Ref<string> | string) {
  const { setActivity } = useService(PresenceServiceKey)
  onMounted(() => {
    const a = isRef(activity) ? activity.value : activity
    if (a) {
      setActivity(a)
    }
  })
  addEventListener('focus', () => {
    const a = isRef(activity) ? activity.value : activity
    if (a) {
      setActivity(a)
    }
  })
  if (isRef(activity)) {
    watch(activity, (a) => {
      if (a) {
        setActivity(a)
      }
    })
  }
}
