const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function normalizePort(url: URL) {
  if (url.port) return url.port
  if (url.protocol === 'https:') return '443'
  if (url.protocol === 'http:') return '80'
  return ''
}

/**
 * Microsoft / WebView2 often rewrite `localhost` to `127.0.0.1` (or IPv6) on
 * the loopback OAuth callback. Origin-string equality then misses the code.
 */
export function isOAuthLoopbackRedirect(target: URL, redirect: URL) {
  if (target.protocol !== redirect.protocol) return false
  if (target.pathname !== redirect.pathname) return false
  if (target.origin === redirect.origin) return true
  return loopbackHosts.has(target.hostname) &&
    loopbackHosts.has(redirect.hostname) &&
    normalizePort(target) === normalizePort(redirect)
}

export function parseOAuthRedirect(url: string, redirect: URL) {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return undefined
  }
  if (!isOAuthLoopbackRedirect(target, redirect)) return undefined
  return target
}
