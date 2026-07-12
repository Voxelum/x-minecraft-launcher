import { YggdrasilApi, YggdrasilSchema } from '@xmcl/runtime-api'
import { readJson, writeJson } from 'fs-extra'
import { join } from 'path'
import { InjectionKey, LauncherApp } from '~/app'
import { kFlights, Logger } from '~/infra'
import { loadYggdrasilApiProfile } from './user'

const BUILTIN_CLIENT = {
  'open.littleskin.cn': '393'
} as Record<string, string>

export const kYggdrasilSeriveRegistry: InjectionKey<YggdrasilSeriveRegistry> = Symbol('YggdrasilSeriveRegistry')

export class YggdrasilSeriveRegistry {
  private yggdrasilServices: YggdrasilApi[] = []

  private yggdrasilJsonPath: string

  private logger: Logger

  constructor(private app: LauncherApp) {
    this.logger = app.getLogger('YggdrasilSeriveRegistry')
    this.yggdrasilJsonPath = join(app.appDataPath, 'yggdrasil.json')

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

  private async getDefaultYggdrasilServices(): Promise<YggdrasilSchema> {
    const loadProfile = async (url: string) => {
      try {
        return await loadYggdrasilApiProfile(url, this.app.fetch)
      } catch (e) {
        this.logger.warn(`Failed to load default Yggdrasil API profile for ${url}: ${e}`)
        return { url } as YggdrasilApi
      }
    }
    const yggdrasilServices = await Promise.all([
      loadProfile('https://littleskin.cn/api/yggdrasil'),
      loadProfile('https://authserver.ely.by/api/authlib-injector'),
    ])
    return { yggdrasilServices }
  }

  async load() {
    let apis: YggdrasilSchema
    try {
      const d = await readJson(this.yggdrasilJsonPath)
      apis = YggdrasilSchema.parse(d)
    } catch {
      apis = await this.getDefaultYggdrasilServices()
    }

    const litteSkin = apis.yggdrasilServices.find(a => new URL(a.url).host === 'littleskin.cn')
    if (litteSkin && (!litteSkin.authlibInjector || !litteSkin.ocidConfig)) {
      try {
        const loaded = await loadYggdrasilApiProfile('https://littleskin.cn/api/yggdrasil', this.app.fetch)
        apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(litteSkin), 1)
        apis.yggdrasilServices.push(loaded)
      } catch (e) {
        this.logger.warn(`Failed to update littleskin.cn profile: ${e}`)
      }
    }
    const ely = apis.yggdrasilServices.find(a => new URL(a.url).host === 'authserver.ely.by')
    if (ely && !ely.authlibInjector) {
      try {
        const loaded = await loadYggdrasilApiProfile('https://authserver.ely.by/api/authlib-injector', this.app.fetch)
        apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(ely), 1)
        apis.yggdrasilServices.push(loaded)
      } catch (e) {
        this.logger.warn(`Failed to update authserver.ely.by profile: ${e}`)
      }
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
    const data = YggdrasilSchema.parse({ yggdrasilServices: this.yggdrasilServices })
    await writeJson(this.yggdrasilJsonPath, data, { spaces: 2 })
  }

  async removeYggdrasilService(url: string): Promise<void> {
    this.yggdrasilServices = this.yggdrasilServices.filter(a => a.url !== url)
    const data = YggdrasilSchema.parse({ yggdrasilServices: this.yggdrasilServices })
    await writeJson(this.yggdrasilJsonPath, data, { spaces: 2 })
  }
}
