/** Last-resort guard for old profiles and code paths awaiting Vardrynn services. */
export function isUpstreamLauncherUrl(input: string | URL | Request): boolean {
  let url: URL
  try {
    url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'xmcl.app' || host.endsWith('.xmcl.app')) return true
  if (host === 'xmcl-core-api.azurewebsites.net' || host === 'xmcl.blob.core.windows.net') return true
  let pathname = url.pathname
  try { pathname = decodeURIComponent(pathname) } catch { /* Keep malformed paths unchanged. */ }
  if ((host === 'github.com' || host === 'api.github.com' || host === 'raw.githubusercontent.com') &&
      /^\/(?:repos\/)?voxelum(?:\/|$)/i.test(pathname)) return true
  if (host === 'registry.npmmirror.com' && /^\/@xmcl\/app-/i.test(pathname)) return true
  return false
}
