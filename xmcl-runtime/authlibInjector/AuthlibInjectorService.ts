import { LibraryInfo, MinecraftFolder } from '@xmcl/core'
import { download } from '@xmcl/file-transfer'
import { AuthlibInjectorServiceKey, AuthlibInjectorService as IAuthlibInjectorService, Settings, TaskInstallAuthlibInjector } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs-extra'
import { request } from 'undici'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { GFW } from '~/gfw'
import { NetworkInterface, kDownloadOptions, kNetworkInterface } from '~/network'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { validateSha256 } from '../util/fs'

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
    @Inject(kTaskExecutor) private routine: TaskFn,
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

    const _download = async (content: any) => {
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

      const task = this.routine(TaskInstallAuthlibInjector)
      await task.wrap(download({
        url: urls,
        validator: {
          algorithm: 'sha256',
          hash: content.checksums.sha256,
        },
        destination: path,
        ...downloadOptions,
        signal: task.signal,
      }))

      this.#abortController.signal.addEventListener('abort', () => task.abort())

      return path
    }

    let path: string

    try {
      const response = await request('https://authlib-injector.yushi.moe/artifact/latest.json', {
        throwOnError: true,
        signal: this.#abortController.signal,
      })
      const body = await response.body.json() as any
      await writeFile(jsonPath, JSON.stringify(body))
      path = await _download(body)
    } catch (e) {
      const content = await readFile(jsonPath, 'utf-8').then(JSON.parse).catch(() => undefined)
      if (content) {
        path = await _download(content)
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
