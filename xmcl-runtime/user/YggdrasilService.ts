import { YggdrasilService as IYggdrasilService, YggdrasilApi, YggdrasilSchema, YggdrasilServiceKey } from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { kClientToken } from '~/clientToken'
import { AbstractService, ExposeServiceKey } from '~/service'
import { createSafeFile } from '~/util/persistance'
import { YggdrasilAccountSystem } from './accountSystems/YggdrasilAccountSystem'
import { loadYggdrasilApiProfile } from './user'
import { UserTokenStorage, kUserTokenStorage } from './userTokenStore'

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
  ) {
    super(app, async () => {
      const apis = await this.yggdrasilFile.read()
      const litteSkin = apis.yggdrasilServices.find(a => new URL(a.url).host === 'littleskin.cn')
      if (litteSkin && !litteSkin.authlibInjector) {
        apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(litteSkin), 1)
        apis.yggdrasilServices.push(await loadYggdrasilApiProfile('https://littleskin.cn/api/yggdrasil'))
      }
      const ely = apis.yggdrasilServices.find(a => new URL(a.url).host === 'authserver.ely.by')
      if (ely && !ely.authlibInjector) {
        apis.yggdrasilServices.splice(apis.yggdrasilServices.indexOf(ely), 1)
        apis.yggdrasilServices.push(await loadYggdrasilApiProfile('https://authserver.ely.by/api/authlib-injector'))
      }
      this.yggdrasilServices.push(...apis.yggdrasilServices)
    })

    this.yggdrasilAccountSystem = new YggdrasilAccountSystem(
      app,
      this,
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
