import { Client } from 'undici'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { GFW } from '../entities/gfw'

export const pluginGFW: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('GFW')
  async function updateGFW() {
    const taobao = new Client('https://npm.taobao.org')
    const google = new Client('https://www.google.com')
    const inGFW = await Promise.race([
      taobao.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => true, () => false),
      google.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      }).then(() => false, () => true),
    ])
    logger.log(inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.')
    taobao.close()
    google.close()
    return inGFW
  }
  app.registry.register(GFW, new GFW(updateGFW()))
}
