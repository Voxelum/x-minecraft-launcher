import { describe, expect, it } from 'vitest'
import { isUpstreamLauncherUrl } from './upstreamNetworkPolicy'

describe('upstream network policy', () => {
  it.each([
    'https://api.xmcl.app/latest',
    'https://api-staging.xmcl.app/flights',
    'https://xmcl-core-api.azurewebsites.net/api/latest',
    'https://xmcl.blob.core.windows.net/releases/xmcl.appinstaller',
    'https://github.com/Voxelum/x-minecraft-launcher/releases',
    'https://api.github.com/repos/voxelum/x-minecraft-launcher/contributors',
    'https://registry.npmmirror.com/@xmcl/app-linux/-/app-linux-1.tgz',
    'https://api.xmcl.app./latest',
    'wss://signaling.xmcl.app./socket',
    'https://api.github.com./repos/Voxelum/x-minecraft-launcher/releases',
    'https://github.com/%56oxelum/x-minecraft-launcher/releases',
    'https://registry.npmmirror.com/@xmcl%2fapp-linux/-/app-linux-1.tgz',
  ])('blocks %s', (url) => expect(isUpstreamLauncherUrl(url)).toBe(true))

  it.each([
    'https://api.modrinth.com/v2/project',
    'https://launchercontent.mojang.com/v2/news.json',
    'https://github.com/example/voxelum',
  ])('allows unrelated destination %s', (url) => expect(isUpstreamLauncherUrl(url)).toBe(false))
})
