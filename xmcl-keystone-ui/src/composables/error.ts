import { isException, NetworkErrorCode, NetworkException } from '@xmcl/runtime-api'

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
    if (e.message) return e.message
    const str = JSON.stringify(e, undefined, 4)
    return str.trim() === '{}' ? e : str
  }
  return tError
}
