
import { YggdrasilService as IYggdrasilService, YggdrasilApi, YggdrasilSchema, YggdrasilServiceKey } from '@xmcl/runtime-api'
import { Pool } from 'undici'
import { YggdrasilAccountSystem } from '../accountSystems/YggdrasilAccountSystem'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'
import { kClientToken } from '../entities/clientToken'
import { UserTokenStorage, kUserTokenStorage } from '../entities/userTokenStore'
import { loadYggdrasilApiProfile } from '../entities/user'
import { createSafeFile } from '../util/persistance'
import { kNetworkInterface, NetworkInterface } from '../entities/networkInterface'

@ExposeServiceKey(YggdrasilServiceKey)
export class YggdrasilService extends AbstractService implements IYggdrasilService {
  private yggdrasilFile = createSafeFile(this.getAppDataPath('yggdrasil.json'), YggdrasilSchema, this, undefined, async () => {
    const apis = await Promise.all([
      loadYggdrasilApiProfile('https://littleskin.cn/api/yggdrasil'),
      loadYggdrasilApiProfile('https://authserver.ely.by/api/authlib-injector'),
    ])
    return {
      yggdrasilServices: apis,
    }
  })

  private yggdrasilServices: YggdrasilApi[] = []
  readonly yggdrasilAccountSystem: YggdrasilAccountSystem

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kClientToken) clientToken: string,
    @Inject(kUserTokenStorage) tokenStorage: UserTokenStorage,
    @Inject(kNetworkInterface) networkInterface: NetworkInterface,
  ) {
    super(app, async () => {
      const apis = await this.yggdrasilFile.read()
      this.yggdrasilServices.push(...apis.yggdrasilServices)
    })

    const dispatcher = networkInterface.registerAPIFactoryInterceptor((origin, options) => {
      const hosts = this.yggdrasilServices.map(v => new URL(v.url).hostname)
      if (hosts.indexOf(origin.hostname) !== -1) {
        return new Pool(origin, {
          ...options,
          pipelining: 1,
          connections: 6,
          keepAliveMaxTimeout: 60_000,
        })
      }
    })

    this.yggdrasilAccountSystem = new YggdrasilAccountSystem(
      this,
      dispatcher,
      clientToken,
      tokenStorage,
    )

    app.protocol.registerHandler('authlib-injector', ({ request, response }) => {
      this.addYggdrasilService(request.url.pathname)
    })
  }

  getYggdrasilServices(): Promise<YggdrasilApi[]> {
    return Promise.resolve(this.yggdrasilServices)
  }

  async addYggdrasilService(url: string): Promise<void> {
    if (url.startsWith('authlib-injector:')) url = url.substring('authlib-injector:'.length)
    if (url.startsWith('yggdrasil-server:')) url = url.substring('yggdrasil-server:'.length)
    url = decodeURIComponent(url)
    const parsed = new URL(url)
    const domain = parsed.host

    this.log(`Add ${url} as yggdrasil (authlib-injector) api service ${domain}`)

    const api = await loadYggdrasilApiProfile(url)
    this.yggdrasilServices.push(api)
  }

  async removeYggdrasilService(url: string): Promise<void> {
    this.yggdrasilServices = this.yggdrasilServices.filter(a => a.url !== url)
  }
}
