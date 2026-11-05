// Minimal Vardrynn service. Implements the status and release routes of VARDRYNN_SERVICE_API.md.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

// The manifest is served as CI signed it. The launcher verifies it, so this only guards against
// a bad upload. The optional RELEASES R2 binding holds it as `latest.json`.
async function latestRelease(env) {
  if (!env.RELEASES) return json({ error: 'not_found' }, 404)
  try {
    const object = await env.RELEASES.get('latest.json')
    if (!object) return json({ error: 'not_found' }, 404)
    const release = await object.json()
    if (release?.apiVersion !== 'v1') return json({ error: 'release_unavailable' }, 503)
    return json(release)
  } catch {
    return json({ error: 'release_unavailable' }, 503)
  }
}

export default {
  async fetch(request, env = {}) {
    const { pathname } = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405)
    }
    if (pathname === '/v1/status') return json({ apiVersion: 'v1', state: 'ok' })
    if (pathname === '/v1/releases/latest') return latestRelease(env)
    return json({ error: 'not_found' }, 404)
  },
}
