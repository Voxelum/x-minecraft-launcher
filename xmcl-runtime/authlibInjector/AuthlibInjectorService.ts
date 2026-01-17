import { LibraryInfo, MinecraftFolder } from '@xmcl/core'
import { download, ProgressTrackerSingle } from '@xmcl/file-transfer'
import {
  AuthlibInjectorServiceKey,
  type AuthlibInjectorService as IAuthlibInjectorService,
  Settings,
  InstallAuthlibInjectorTask,
  InstallAuthlibInjectorTrackerEvents,
} from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs-extra'
import { Inject, LauncherAppKey, type PathResolver, kGameDataPath } from '~/app'
import { GFW, kGFW, kTasks, type Tasks } from '~/infra'
import { kDownloadOptions } from '~/network'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { getApiSets, kSettings } from '~/settings'
import { AnyError } from '@xmcl/utils'
import { LauncherApp } from '../app/LauncherApp'
import { validateSha256 } from '../util/fs'
import { Tracker, onDownloadSingle } from '@xmcl/installer'
import { getTracker } from '~/util/taskHelper'

const AUTHLIB_ORG_NAME = 'org.to2mbn:authlibinjector'

/**
 * Majorly support the third party skin using authlib injector
 */
@ExposeServiceKey(AuthlibInjectorServiceKey)
export class AuthlibInjectorService extends AbstractService implements IAuthlibInjectorService {
  #abortController = new AbortController()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kSettings) private settings: Settings,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kGFW) gfw: GFW,
  ) {
    super(app)
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

    const doDownload = async (content: any) => {
      const name = `${AUTHLIB_ORG_NAME}:${content.version}`
      const info = LibraryInfo.resolve(name)
      const path = mc.getLibraryByPath(info.path)

      const url = new URL(content.download_url)
      const allSets = getApiSets(this.settings)
      const urls = allSets
        .map(
          (s) =>
            new URL(
              url.pathname.startsWith('/mirrors')
                ? url.pathname
                : `/mirrors/authlib-injector${url.pathname}`,
              new URL(s.url).origin,
            ),
        )
        .map((u) => u.toString())

      if (urls.indexOf(url.toString()) === -1) {
        urls.unshift(url.toString())
      }

      const downloadOptions = await this.app.registry.get(kDownloadOptions)
      if (this.#abortController.signal.aborted) {
        throw new AnyError('AbortError', 'The authlib injector installation is aborted by user.')
      }

      const task = this.tasks.create<InstallAuthlibInjectorTask>({
        type: 'installAuthlibInjector',
        key: 'install-authlib-injector',
        version: content.version,
      })

      this.#abortController.signal.addEventListener('abort', () => task.controller.abort())

      const tracker: Tracker<InstallAuthlibInjectorTrackerEvents> = getTracker(task)

      try {
        await download({
          url: urls,
          destination: path,
          signal: task.controller.signal,
          tracker: onDownloadSingle(tracker, 'download', {}),
          ...downloadOptions,
        })
        task.complete()
      } catch (error) {
        task.fail(error)
        throw error
      }

      return path
    }

    let path: string

    try {
      const response = await this.app.fetch(
        'https://authlib-injector.yushi.moe/artifact/latest.json',
        {
          signal: this.#abortController.signal,
        },
      )
      const body = await response.json()
      await writeFile(jsonPath, JSON.stringify(body))
      path = await doDownload(body)
    } catch (e) {
      const content = await readFile(jsonPath, 'utf-8')
        .then(JSON.parse)
        .catch(() => undefined)
      if (content) {
        path = await doDownload(content)
      } else {
        throw e
      }
    }

    return path
  }

  async isAuthlibInjectorReady() {
    const jsonPath = this.getPath('authlib-injection.json')
    const content = await readFile(jsonPath, 'utf-8')
      .then(JSON.parse)
      .catch(() => undefined)
    if (!content) return false
    const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`)
    const mc = new MinecraftFolder(this.getPath())
    const libPath = mc.getLibraryByPath(info.path)
    return validateSha256(libPath, content.checksums.sha256)
  }
}
