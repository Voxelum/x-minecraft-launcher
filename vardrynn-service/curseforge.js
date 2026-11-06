// CurseForge API proxy. The launcher sends CurseForge API calls to /v1/curseforge/<CurseForge path>,
// and this adds the API key, so the key never ships inside the launcher.
// Secret: CURSEFORGE_API_KEY. Optional binding: CURSEFORGE_RATE_LIMITER (per client address).

const PREFIX = '/v1/curseforge/'
const UPSTREAM = 'https://api.curseforge.com'
// Only CurseForge API versions; nothing else on the host is reachable through the proxy.
const UPSTREAM_PATH = /^\/v[12]\/[A-Za-z0-9/_-]*$/
const MAX_BODY_BYTES = 1024 * 1024
const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type']
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified']

const error = (code, status) =>
  new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export async function handleCurseforgeRoute(request, env, pathname) {
  if (!pathname.startsWith(PREFIX)) return undefined
  const upstreamPath = pathname.slice(PREFIX.length - 1)
  if (!UPSTREAM_PATH.test(upstreamPath)) return error('not_found', 404)
  if (request.method !== 'GET' && request.method !== 'POST') return error('method_not_allowed', 405)
  if (!env.CURSEFORGE_API_KEY) return error('curseforge_unavailable', 503)

  if (env.CURSEFORGE_RATE_LIMITER) {
    const key = request.headers.get('cf-connecting-ip') || 'unknown'
    const { success } = await env.CURSEFORGE_RATE_LIMITER.limit({ key })
    if (!success) return error('rate_limited', 429)
  }

  const headers = new Headers({ 'x-api-key': env.CURSEFORGE_API_KEY })
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  let body
  if (request.method === 'POST') {
    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_BODY_BYTES) return error('body_too_large', 413)
    body = await request.arrayBuffer()
    if (body.byteLength > MAX_BODY_BYTES) return error('body_too_large', 413)
  }

  const { search } = new URL(request.url)
  let response
  try {
    // A redirect could carry the key elsewhere, so it is not followed.
    response = await fetch(`${UPSTREAM}${upstreamPath}${search}`, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch {
    return error('curseforge_unreachable', 502)
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    return error('curseforge_unreachable', 502)
  }
  const out = new Headers()
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(name)
    if (value) out.set(name, value)
  }
  return new Response(response.body, { status: response.status, headers: out })
}
