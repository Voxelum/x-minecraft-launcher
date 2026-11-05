import { describe, expect, it } from 'vitest'
import { MockAgent, fetch, interceptors } from 'undici'
import { upstreamNetworkInterceptor } from './upstreamNetworkInterceptor'

describe('upstream download isolation', () => {
  it.each(['/latest', '//example.com/asset'])('rejects a direct upstream download before dispatch: %s', async (path) => {
    const network = new MockAgent()
    network.disableNetConnect()
    network.get('https://api.xmcl.app').intercept({ path }).reply(200, 'upstream reached')
    try {
      const response = fetch('https://api.xmcl.app' + path, {
        dispatcher: network.compose(upstreamNetworkInterceptor),
      })
      await expect(response).rejects.toMatchObject({ cause: { message: 'Upstream launcher service is disabled' } })
      expect(network.pendingInterceptors()).toHaveLength(1)
    } finally { await network.close() }
  })

  it.each(['/latest', '//example.com/asset'])('checks the target of an allowed download redirect before dispatch: %s', async (path) => {
    const network = new MockAgent()
    network.disableNetConnect()
    network.get('https://content.example').intercept({ path: '/download' })
      .reply(302, '', { headers: { location: 'https://api.xmcl.app' + path } })
    network.get('https://api.xmcl.app').intercept({ path }).reply(200, 'upstream reached')
    try {
      const response = fetch('https://content.example/download', {
        dispatcher: network.compose(upstreamNetworkInterceptor, interceptors.redirect({ maxRedirections: 5 })),
      })
      await expect(response).rejects.toMatchObject({ cause: { message: 'Upstream launcher service is disabled' } })
      expect(network.pendingInterceptors()).toHaveLength(1)
    } finally { await network.close() }
  })

  it('preserves ordinary provider downloads', async () => {
    const network = new MockAgent()
    network.disableNetConnect()
    network.get('https://api.modrinth.com').intercept({ path: '/v2/project' }).reply(200, 'provider reached')
    try {
      const response = await fetch('https://api.modrinth.com/v2/project', {
        dispatcher: network.compose(upstreamNetworkInterceptor),
      })
      expect(await response.text()).toBe('provider reached')
      network.assertNoPendingInterceptors()
    } finally { await network.close() }
  })
})
