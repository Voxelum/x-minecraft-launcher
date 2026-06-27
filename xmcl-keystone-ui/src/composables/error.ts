import { isException, ModpackException, NetworkErrorCode, NetworkException, BedrockException } from '@xmcl/runtime-api'

export function useLocaleError() {
  const { t } = useI18n()
  const tError = (e: any) => {
    if (!e) return ''
    if (isException(NetworkException, e)) {
      const ex = e.exception
      if (ex.code === NetworkErrorCode.CONNECTION_TIMED_OUT) return t('errors.ConnectTimeoutError')
      if (ex.code === NetworkErrorCode.DNS_NOTFOUND) return t('errors.DNSNotFoundError')
      if (ex.code === NetworkErrorCode.CONNECTION_CLOSED) return t('errors.SocketError')
      if (ex.code === NetworkErrorCode.CONNECTION_RESET) return t('errors.SocketError')
      if (ex.code === NetworkErrorCode.SOCKET_NOT_CONNECTED) return t('errors.SocketError')
      if (ex.type === 'httpException') {
        if (ex.statusCode === 404) return t('errors.NotFoundError')
        return [(ex.code || ''), ex.statusCode, JSON.stringify(ex.body)].join(' ')
      }
    }
    if (isException(ModpackException, e)) {
      if (e.exception.type === 'invalidModpack') return t('errors.BadInstanceType', {
        type: e.exception.path
      })
    }
    if (isException(BedrockException, e)) {
      const ex = e.exception
      return t(`errors.${ex.type}`)
    }
    if (e && typeof e === 'object' && 'type' in e) {
      if (e.type === 'bedrockUnsupportedPlatform' || e.type === 'bedrockNotInstalled' || e.type === 'bedrockLaunchFailed' || e.type === 'bedrockInstallFailed') {
        return t(`errors.${e.type}`)
      }
    }
    if (e.message) return e.message
    const str = JSON.stringify(e, undefined, 4)
    return str.trim() === '{}' ? e : str
  }
  return tError
}
