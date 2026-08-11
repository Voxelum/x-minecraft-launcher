import type { Router, RouteLocationRaw } from 'vue-router'
import { nextTick, onUnmounted } from 'vue'
import { useAgentChatOpen } from '../agentChat'

interface PendingAgentRoute {
  origin: string
  destinationPath: string
}

let pending: PendingAgentRoute | undefined

export async function openRouteFromAgent(router: Router, to: RouteLocationRaw, destinationPath: string) {
  pending = {
    origin: router.currentRoute.value.fullPath,
    destinationPath,
  }
  try {
    await router.push(to)
  } catch (error) {
    pending = undefined
    throw error
  }
}

export function useAgentRouteReturn() {
  const router = useRouter()
  const { open: openAgentChat } = useAgentChatOpen()
  const remove = router.afterEach(async (to) => {
    const current = pending
    if (!current) return
    if (to.fullPath === current.origin) {
      pending = undefined
      await nextTick()
      openAgentChat()
    } else if (to.path !== current.destinationPath) {
      pending = undefined
    }
  })
  onUnmounted(remove)
}
