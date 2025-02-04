import { YggdrasilApi, YggdrasilSchema } from '@xmcl/runtime-api'
import { join } from 'path'
import { LauncherApp } from '~/app'
import { kFlights } from '~/flights'
import { Logger } from '~/logger'
import { SafeFile, createSafeFile } from '~/util/persistance'
import { loadYggdrasilApiProfile } from './user'

const BUILTIN_CLIENT = {
  'open.littleskin.cn': '393'
} as Record<string, string>

export const kYggdrasilSeriveRegistry = Symbol('YggdrasilSeriveRegistry')

export class YggdrasilSeriveRegistry {
  private yggdrasilServices: YggdrasilApi[] = []

  private yggdrasilFile: SafeFile<YggdrasilSchema>

  private logger: Logger

  constructor(private app: LauncherApp) {
    this.logger = app.getLogger('YggdrasilSeriveRegistry')
    this.yggdrasilFile = createSafeFile(join(app.appDataPath, 'yggdrasil.json'), YggdrasilSchema, this.logger, undefined, async () => {
      const yggdrasilServices = await Promise.all([
        loadYggdrasilApiProfile('https://littleskin.cn/api/yggdrasil', app.fetch),
        loadYggdrasilApiProfile('https://authserver.ely.by/api/authlib-injector', app.fetch),
      ])
      return {
        yggdrasilServices,
      }
    })
    app.protocol.registerHandler('authlib-injector', ({ request, response }) => {
      this.addYggdrasilService(request.url.pathname)
    })

    app.registry.get(kFlights).then((flights) => {
      const clients = flights['yggdrasilClients']
      if (clients && typeof clients === 'object') {
        for (const [host, clientId] of Object.entries(clients)) {
          if (typeof clientId === 'string') {
            BUILTIN_CLIENT[host] = clientId
          }
        }
      }
    })
  }

  async load() {
    const apis = await this.yggdrasilFile.read()
    const litteSkin = apis.yggdrasilServices.find(a => new URL(a.url).host === 'littleskin.cn')
    if (litteSkin && (!litteSkin.authlibInjector || !litteSkin.ocidConfig)) {
      apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(litteSkin), 1)
      apis.yggdrasilServices.push(await loadYggdrasilApiProfile('https://littleskin.cn/api/yggdrasil', this.app.fetch))
    }
    const ely = apis.yggdrasilServices.find(a => new URL(a.url).host === 'authserver.ely.by')
    if (ely && !ely.authlibInjector) {
      apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(ely), 1)
      apis.yggdrasilServices.push(await loadYggdrasilApiProfile('https://authserver.ely.by/api/authlib-injector', this.app.fetch))
    }

    this.yggdrasilServices.push(...apis.yggdrasilServices)
  }

  getYggdrasilServices(): YggdrasilApi[] {
    return this.yggdrasilServices
  }

  getClientId(authServer: string) {
    const host = new URL(authServer).host
    return BUILTIN_CLIENT[host]
  }

  async addYggdrasilService(url: string): Promise<void> {
    if (url.startsWith('authlib-injector:')) url = url.substring('authlib-injector:'.length)
    if (url.startsWith('yggdrasil-server:')) url = url.substring('yggdrasil-server:'.length)
    url = decodeURIComponent(url)
    const parsed = new URL(url)
    const domain = parsed.host

    this.logger.log(`Add ${url} as yggdrasil (authlib-injector) api service ${domain}`)

    const api = await loadYggdrasilApiProfile(url)
    // check dup
    const existed = this.yggdrasilServices.find(a => new URL(a.url).host === new URL(url).host)
    if (existed) {
      if (existed.authlibInjector && !api.authlibInjector) {
        return
      }
      if (!existed.authlibInjector && api.authlibInjector) {
        this.yggdrasilServices = this.yggdrasilServices.filter(a => new URL(a.url).host !== new URL(url).host)
      }
    }

    this.yggdrasilServices.push(api)
    await this.yggdrasilFile.write({ yggdrasilServices: this.yggdrasilServices })
  }

  async removeYggdrasilService(url: string): Promise<void> {
    this.yggdrasilServices = this.yggdrasilServices.filter(a => a.url !== url)
    await this.yggdrasilFile.write({ yggdrasilServices: this.yggdrasilServices })
  }
}
