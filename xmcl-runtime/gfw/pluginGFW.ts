import { Client } from 'undici'
import { LauncherAppPlugin } from '~/app'
import { GFW } from './gfw'

export const pluginGFW: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('GFW')
  async function updateGFW() {
    const taobao = new Client('https://npm.taobao.org')
    const google = new Client('https://www.google.com')
    const yandex = new Client('https://www.yandex.com')
    const networkEnv = await Promise.any([
      taobao.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => 'cn' as const, () => 'global' as const),
      google.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => 'global' as const, () => 'global' as const),
      yandex.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => 'yandex' as const, () => 'global' as const),
    ])
    logger.log(networkEnv ? 'Detected current in Chinese Mainland.' : 'Detected current NOT in Chinese Mainland.')
    taobao.close()
    google.close()
    return networkEnv
  }
  app.registry.register(GFW, new GFW(updateGFW()))
}
