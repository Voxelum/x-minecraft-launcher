// Minimal Vardrynn service. Implements the status route of VARDRYNN_SERVICE_API.md.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default {
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405)
    }
    if (pathname === '/v1/status') return json({ apiVersion: 'v1', state: 'ok' })
    return json({ error: 'not_found' }, 404)
  },
}
