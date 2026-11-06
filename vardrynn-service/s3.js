// Bucket access for the Worker: AWS Signature V4 presigned URLs, path style. The launcher has no bucket credentials.
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

const encoder = new TextEncoder()
export const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
const hmac = async (key, data) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data))
const rfc3986 = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// A GET with the read-only key pair unless `options` names another method or key pair.
export async function presign(env, url, expires, now = new Date(), options = {}) {
  const {
    method = 'GET',
    accessKeyId = env.S3_READ_ACCESS_KEY_ID,
    secretAccessKey = env.S3_READ_SECRET_ACCESS_KEY,
  } = options
  const region = env.S3_REGION || 'us-east-1'
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = stamp.slice(0, 8)
  const scope = `${day}/${region}/s3/aws4_request`
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuery = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`).join('&')
  const path = url.pathname.split('/').map((segment) => rfc3986(decodeURIComponent(segment))).join('/')
  const canonical = [method, path, canonicalQuery, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, hex(await crypto.subtle.digest('SHA-256', encoder.encode(canonical)))].join('\n')
  let key = encoder.encode(`AWS4${secretAccessKey}`)
  for (const part of [day, region, 's3', 'aws4_request']) key = await hmac(key, part)
  return `${url.origin}${path}?${canonicalQuery}&X-Amz-Signature=${hex(await hmac(key, toSign))}`
}

export const s3Configured = (env) =>
  Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_READ_ACCESS_KEY_ID && env.S3_READ_SECRET_ACCESS_KEY)

export const objectUrl = (env, key) => new URL(`${env.S3_BUCKET}/${key}`, `${env.S3_ENDPOINT.replace(/\/?$/, '/')}`)

const OBJECT_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']

// Streams a bucket object to the client, passing through range requests. `unavailable` is the error
// code for missing storage settings or a storage failure.
export async function streamObject(request, env, key, cacheControl, unavailable) {
  if (!s3Configured(env)) return json({ error: unavailable }, 503)
  try {
    // The URL is signed for GET, so a HEAD request reads the headers and drops the body.
    const range = request.headers.get('range')
    const response = await fetch(await presign(env, objectUrl(env, key), 300), {
      redirect: 'manual',
      headers: range ? { range } : {},
    })
    if (response.status === 404) return json({ error: 'not_found' }, 404)
    if (!response.ok) {
      await response.body?.cancel()
      return json({ error: unavailable }, 503)
    }
    const headers = new Headers({ 'cache-control': cacheControl })
    for (const header of OBJECT_HEADERS) {
      const value = response.headers.get(header)
      if (value) headers.set(header, value)
    }
    if (request.method === 'HEAD') await response.body?.cancel()
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
  } catch {
    return json({ error: unavailable }, 503)
  }
}
