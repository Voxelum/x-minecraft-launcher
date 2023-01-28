export function useLocaleError() {
  const { t } = useI18n()
  const tError = (e: any) => {
    if (!e) return ''
    if (e.name === 'HTTPException' && e.exception) {
      e = e.exception
    }
    if (e.code === 'UND_ERR_CONNECT_TIMEOUT') return t('errors.ConnectTimeoutError')
    if (e.code === 'UND_ERR_HEADERS_TIMEOUT') return t('errors.HeadersTimeoutError')
    if (e.code === 'UND_ERR_BODY_TIMEOUT') return t('errors.BodyTimeoutError')
    if (e.code === 'UND_ERR_SOCKET') return t('errors.SocketError')
    if (e.errno === 'ENOTFOUND' && e.syscall === 'getaddrinfo') return t('errors.DNSNotFoundError')
    if (e.errno === 'ECONNRESET') return t('errors.SocketError')
    if (e.code === 'UND_ERR_RESPONSE_STATUS_CODE') {
      return [(e.code || ''), e.statusCode, JSON.stringify(e.body)].join(' ')
    }
    return JSON.stringify(e)
  }
  return tError
}
