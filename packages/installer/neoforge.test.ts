import { MinecraftFolder } from '@xmcl/core'
import { expect, test, vi } from 'vitest'
import { resolveNeoForgedInstallerFile } from './neoforge'

test('resolves NeoForge installer checksum, size, and mirror fallback URLs', async ({ temp }) => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') {
      return new Response(null, { headers: { 'content-length': '6733676' } })
    }
    expect(url).toMatch(/\.jar\.sha1$/)
    return new Response('c419a63a0f49fa33d28980fc6b8974a7528eebcb')
  })
  const folder = MinecraftFolder.from(temp)

  const { file } = await resolveNeoForgedInstallerFile('neoforge', '21.1.1', folder, {
    fetch,
    mavenHost: ['https://bmclapi2.bangbang93.com/maven'],
  })

  expect(fetch).toHaveBeenCalledTimes(2)
  expect(file).toMatchObject({
    size: 6733676,
    checksum: { algorithm: 'sha1', value: 'c419a63a0f49fa33d28980fc6b8974a7528eebcb' },
    urls: [
      'https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/21.1.1/neoforge-21.1.1-installer.jar',
      'https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.1/neoforge-21.1.1-installer.jar',
      'https://repo1.maven.org/maven2/net/neoforged/neoforge/21.1.1/neoforge-21.1.1-installer.jar',
    ],
  })
})