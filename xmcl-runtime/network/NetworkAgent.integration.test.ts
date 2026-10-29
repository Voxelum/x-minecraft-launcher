import { createServer } from 'node:http'
import { once } from 'node:events'
import { Agent, Pool, interceptors, request } from 'undici'
import { expect, test } from 'vitest'
import { NetworkAgent } from './NetworkAgent'

test('real custom pools preserve requests, redirects, retries, ranges, cancellation and client cleanup', async () => {
  let retries = 0
  let userAgent: string | undefined
  const server = createServer((req, res) => {
    userAgent = req.headers['user-agent']
    if (req.url === '/redirect') { res.writeHead(302, { location: '/ok' }); res.end(); return }
    if (req.url === '/retry' && retries++ === 0) { res.writeHead(503); res.end(); return }
    if (req.url === '/slow') { res.writeHead(200); res.write('start'); return }
    if (req.headers.range === 'bytes=2-5') {
      res.writeHead(206, { 'content-range': 'bytes 2-5/10' }); res.end('2345'); return
    }
    res.end('0123456789')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No loopback address')
  const origin = `http://127.0.0.1:${address.port}`
  const activity: boolean[] = []
  const agent = new NetworkAgent({
    userAgent: 'xmcl-security-regression',
    requestTls: {},
    proxyTls: {},
    factory: (connect) => new Agent({ connect, factory: (url, opts) => new Pool(url, { ...opts, connections: 2 }) }).compose(
      interceptors.retry({ maxRetries: 1, minTimeout: 1, maxTimeout: 5 }),
      interceptors.redirect({ maxRedirections: 5 }),
    ) as Agent,
  }, (active) => activity.push(active))
  try {
    for (const path of ['/ok', '/redirect', '/retry']) {
      const response = await request(origin + path, { dispatcher: agent })
      expect(response.statusCode).toBe(200)
      expect(await response.body.text()).toBe('0123456789')
    }
    expect(retries).toBe(2)
    expect(userAgent).toBe('xmcl-security-regression')
    const ranged = await request(origin + '/range', { dispatcher: agent, headers: { range: 'bytes=2-5' } })
    expect(ranged.statusCode).toBe(206)
    expect(ranged.headers['content-range']).toBe('bytes 2-5/10')
    expect(await ranged.body.text()).toBe('2345')
    const controller = new AbortController()
    const slow = await request(origin + '/slow', { dispatcher: agent, signal: controller.signal })
    const body = slow.body.text()
    controller.abort()
    await expect(body).rejects.toThrow()
    const clients = agent.getClients()
    expect(clients).toBeInstanceOf(Map)
    expect(clients.get(origin)?.dispatcher).toBeInstanceOf(Pool)
    await agent.destroyClient(origin)
    expect(agent.getClients().size).toBe(0)
    expect(activity).toEqual([true, false])
    const resumed = await request(origin + '/ok', { dispatcher: agent })
    expect(await resumed.body.text()).toBe('0123456789')
    expect(agent.getClients().size).toBe(1)
    await agent.destroyClient(origin)
    expect(agent.getClients().size).toBe(0)
  } finally {
    await agent.close()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}, 15_000)
