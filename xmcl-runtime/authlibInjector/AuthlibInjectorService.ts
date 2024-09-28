import { LibraryInfo, MinecraftFolder } from '@xmcl/core'
import { DownloadTask } from '@xmcl/installer'
import { AuthlibInjectorServiceKey, AuthlibInjectorService as IAuthlibInjectorService, Settings } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs-extra'
import { NetworkInterface, kDownloadOptions, kNetworkInterface } from '~/network'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, PathResolver, kGameDataPath, Inject } from '~/app'
import { GFW } from '~/gfw'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { validateSha256 } from '../util/fs'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { AnyError } from '~/util/error'

const AUTHLIB_ORG_NAME = 'org.to2mbn:authlibinjector'

/**
 * Majorly support the third party skin using authlib injector
 */
@ExposeServiceKey(AuthlibInjectorServiceKey)
export class AuthlibInjectorService extends AbstractService implements IAuthlibInjectorService {
  #abortController = new AbortController()

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kSettings) private settings: Settings,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(GFW) gfw: GFW,
    @Inject(kNetworkInterface) networkInterface: NetworkInterface,
  ) {
    super(app)

    networkInterface.registerOptionsInterceptor((options) => {
      const origin = options.origin instanceof URL ? options.origin : new URL(options.origin! as any)
      if (origin.hostname === 'authlib-injector.yushi.moe') {
        if (shouldOverrideApiSet(settings, gfw.inside)) {
          const api = settings.apiSets.find(a => a.name === settings.apiSetsPreference) || settings.apiSets[0]
          options.origin = new URL(api.url).origin
          options.path = `/mirrors/authlib-injector${options.path}`
        }
      }
    })
  }

  async abortAuthlibInjectorInstall(): Promise<void> {
    this.#abortController.abort()
  }

  @Lock('authlib-injector')
  async getOrInstallAuthlibInjector(): Promise<string> {
    const jsonPath = this.getPath('authlib-injection.json')
    const root = this.getPath()
    const mc = new MinecraftFolder(root)
    this.#abortController = new AbortController()

    const download = async (content: any) => {
      const name = `${AUTHLIB_ORG_NAME}:${content.version}`
      const info = LibraryInfo.resolve(name)
      const path = mc.getLibraryByPath(info.path)

      const url = new URL(content.download_url)
      const allSets = getApiSets(this.settings)
      const urls = allSets.map(s => new URL(url.pathname.startsWith('/mirrors') ? url.pathname : `/mirrors/authlib-injector${url.pathname}`, new URL(s.url).origin)).map(u => u.toString())

      if (urls.indexOf(url.toString()) === -1) {
        urls.unshift(url.toString())
      }

      const downloadOptions = await this.app.registry.get(kDownloadOptions)
      if (this.#abortController.signal.aborted) {
        throw new AnyError('AbortError', 'The authlib injector installation is aborted by user.')
      }
      const task = new DownloadTask({
        url: urls,
        validator: {
          algorithm: 'sha256',
          hash: content.checksums.sha256,
        },
        destination: path,
        ...downloadOptions,
      }).setName('installAuthlibInjector')
      this.#abortController.signal.addEventListener('abort', () => task.cancel(3000))
      await this.submit(task)

      return path
    }

    let path: string

    try {
      const response = await this.app.fetch('https://authlib-injector.yushi.moe/artifact/latest.json', {
        signal: this.#abortController.signal,
      })
      const body = await response.json()
      await writeFile(jsonPath, JSON.stringify(body))
      path = await download(body)
    } catch (e) {
      const content = await readFile(jsonPath, 'utf-8').then(JSON.parse).catch(() => undefined)
      if (content) {
        path = await download(content)
      } else {
        throw e
      }
    }

    return path
  }

  async isAuthlibInjectorReady() {
    const jsonPath = this.getPath('authlib-injection.json')
    const content = await readFile(jsonPath, 'utf-8').then(JSON.parse).catch(() => undefined)
    if (!content) return false
    const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`)
    const mc = new MinecraftFolder(this.getPath())
    const libPath = mc.getLibraryByPath(info.path)
    return validateSha256(libPath, content.checksums.sha256)
  }
}
