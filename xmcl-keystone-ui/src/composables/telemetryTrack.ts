import { appInsights, setTelemetryDeviceId } from '@/telemetry'
import { useService } from './service'
import {
  BaseServiceKey,
  SharedState,
  Settings,
  XmclAccountServiceKey,
  type XmclAccountSnapshot,
} from '@xmcl/runtime-api'
import { Ref } from 'vue'

export function useTelemetryTrack(settings: Ref<SharedState<Settings> | undefined>) {
  // const router = useRouter()
  const { getDeviceId, getEnvironment, getSessionId } = useService(BaseServiceKey)
  const { getXmclAccountState } = useService(XmclAccountServiceKey)
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
    appInsights.context.session.id = sessionId
  })
  let disposeAccountIdentity = () => {}
  onScopeDispose(() => disposeAccountIdentity())
  Promise.all([getDeviceId(), getXmclAccountState()]).then(([deviceId, accountState]) => {
    const setUserId = (accountId?: string) => {
      appInsights.context.user.id = accountId ?? `device:${deviceId}`
    }
    const onSnapshot = (snapshot: XmclAccountSnapshot) => setUserId(snapshot.account?.accountId)
    const onGuest = () => setUserId()

    setTelemetryDeviceId(deviceId)
    setUserId(accountState.account?.accountId)
    accountState.subscribe('snapshot', onSnapshot)
    accountState.subscribe('guest', onGuest)
    disposeAccountIdentity = () => {
      accountState.unsubscribe('snapshot', onSnapshot)
      accountState.unsubscribe('guest', onGuest)
    }
  })
  watch(settings, (s, _, onCleanup) => {
    if (!s) return
    appInsights.config.disableTelemetry = !!s.disableTelemetry
    const onDisableTelemetrySet = (v: boolean) => {
      appInsights.config.disableTelemetry = !!v
    }
    s.subscribe('disableTelemetrySet', onDisableTelemetrySet)
    onCleanup(() => s.unsubscribe('disableTelemetrySet', onDisableTelemetrySet))
  })
}
