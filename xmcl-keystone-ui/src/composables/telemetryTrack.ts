import { appInsights } from '@/telemetry'
import { useService } from './service'
import { BaseServiceKey } from '@xmcl/runtime-api'

export function useTelemetryTrack() {
  const router = useRouter()
  const { getEnvironment, getSessionId } = useService(BaseServiceKey)
  router.afterEach((to, from) => {
    appInsights.trackPageView({ uri: to.fullPath, refUri: from.fullPath })
  })
  getEnvironment().then(({ version, build }) => {
    appInsights.context.application.ver = version
    appInsights.context.application.build = build.toString()
  })
  getSessionId().then((sessionId) => {
    appInsights.context.user.id = sessionId
    appInsights.context.session.id = sessionId
  })
}
