import { appInsights } from '@/telemetry'
import { useService } from './service'
import { BaseServiceKey, MutableState, Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'

export function useTelemetryTrack(settings: Ref<MutableState<Settings> | undefined>) {
  // const router = useRouter()
  const { getEnvironment, getSessionId } = useService(BaseServiceKey)
  // router.afterEach((to, from) => {
  //   if (settings.value?.disableTelemetry) {
  //     return
  //   }
  //   appInsights.trackPageView({ uri: to.path, refUri: from.path, properties: to.query })
  // })
  getEnvironment().then(({ version, build }) => {
    appInsights.context.application.ver = version
    appInsights.context.application.build = build.toString()
  })
  getSessionId().then((sessionId) => {
    appInsights.context.user.id = sessionId
    appInsights.context.session.id = sessionId
  })
  watch(settings, (s) => {
    if (!s) return
    appInsights.config.disableTelemetry = !!s.disableTelemetry
    s.subscribe('disableTelemetrySet', (v) => {
      appInsights.config.disableTelemetry = !!v
    })
  })
}
