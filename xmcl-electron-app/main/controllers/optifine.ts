import { ElectronController } from '@/ElectronController'
import optifinePreload from '@preload/optifine'
import { OptifineVersion } from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { BrowserWindow } from 'electron'
import { Readable } from 'stream'
import { setTimeout as delay } from 'timers/promises'
import type { Context } from '~/app'
import { kGFW } from '~/infra'
import { kOptifineInstaller } from '~/install'
import { kSettings, shouldOverrideApiSet } from '~/settings'
import { ControllerPlugin } from './plugin'
import { resolveOptifineDownloadSource } from './optifineSource'

const OPTIFINE_HOST = 'https://optifined.net'

// See xmcl-runtime/app/pluginCommonProtocol.ts — same rationale for
// silencing ERR_INVALID_STATE on aborted upstream fetches (issue #1446).
const adaptWebBody = (body: ReadableStream | Readable | null | undefined) => {
  if (!(body instanceof ReadableStream)) return body ?? undefined
  const readable = Readable.fromWeb(body as any)
  readable.on('error', (err: any) => {
    if (err && (err.code === 'ERR_INVALID_STATE' || err.message === 'Invalid state: Controller is already closed')) {
      return
    }
    readable.destroy(err)
  })
  return readable
}

export const optifine: ControllerPlugin = async function (this: ElectronController) {
  let pooled: BrowserWindow | undefined
  let clearTimeout: AbortController | undefined

  const app = this.app
  const gfw = await this.app.registry.get(kGFW)
  async function testShouldOverride() {
    const setting = await app.registry.get(kSettings)
    const isInside = (await gfw.signal) === 'cn'
    const override = shouldOverrideApiSet(setting, isInside)
    return override
  }

  function poolWindow(win: BrowserWindow) {
    if (pooled) {
      win.close()
    } else {
      pooled = win
      clearTimeout?.abort()
      clearTimeout = new AbortController()
      delay(60_000, undefined, { signal: clearTimeout.signal }).then(() => {
        pooled?.close()
        pooled = undefined
      }).catch(() => undefined)
    }
  }

  function createBrowserWindow() {
    if (pooled) {
      const current = pooled
      pooled = undefined
      clearTimeout?.abort()
      clearTimeout = undefined

      return current
    }
    const win = new BrowserWindow({
      title: '',
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 400,
      webPreferences: {
        preload: optifinePreload,
        contextIsolation: false,
        sandbox: false,
      },
      show: false,
    })
    win.webContents.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    return win
  }

  function loadOptifinePage<T>(win: BrowserWindow, url: string, channel: string) {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const complete = (result: { value: T } | { error: Error }) => {
        if (settled) return
        settled = true
        globalThis.clearTimeout(timeout)
        win.webContents.removeListener('ipc-message', onMessage)
        win.webContents.removeListener('did-fail-load', onLoadFailure)
        win.removeListener('closed', onClosed)
        if ('value' in result) resolve(result.value)
        else reject(result.error)
      }
      const onMessage = (_event: Electron.Event, received: string, ...args: unknown[]) => {
        if (received === channel) complete({ value: args[0] as T })
      }
      const onLoadFailure = (
        _event: Electron.Event,
        code: number,
        description: string,
        _validatedUrl: string,
        isMainFrame: boolean,
      ) => {
        if (isMainFrame) complete({ error: Object.assign(new Error(description), { code }) })
      }
      const onClosed = () => complete({ error: new Error('OptiFine resolver window was closed') })
      const timeout = globalThis.setTimeout(() => {
        complete({ error: new Error(`OptiFine resolver timed out after 15000ms: ${channel}`) })
      }, 15_000)
      win.webContents.on('ipc-message', onMessage)
      win.webContents.on('did-fail-load', onLoadFailure)
      win.once('closed', onClosed)
      win.loadURL(url).catch((error) => complete({ error }))
    })
  }

  async function getDownloads() {
    const win = createBrowserWindow()

    try {
      const versions = await loadOptifinePage<OptifineVersion[]>(
        win,
        `${OPTIFINE_HOST}/downloads`,
        'optifine-downloads',
      )
      poolWindow(win)
      return versions
    } catch (error) {
      win.close()
      throw error
    }
  }

  this.app.registry.register(kOptifineInstaller, async (version) => {
    const source = resolveOptifineDownloadSource(version, await testShouldOverride())
    if (source.type === 'mirror') return source.url
    throw new AnyError(
      'OptifineNoMirrorError',
      'OptiFine can only be downloaded from the BMCLAPI mirror, which is disabled by your API source preference.',
    )
  })

  const fetchBmclList = async (ctx: Context) => {
    const body = ctx.request.body
    return this.app.fetch(ctx.request.url.toString(), {
      headers: ctx.request.headers,
      method: ctx.request.method,
      body: body instanceof Readable ? (Readable.toWeb(body) as any) : body,
      redirect: 'follow',
    })
  }

  this.app.protocol.registerHandler('https', async (ctx) => {
    if (ctx.request.url.toString() === 'https://bmclapi2.bangbang93.com/optifine/versionList') {
      const tryScrape = async () => getDownloads().then(
        (result) => result.length > 0 ? result : undefined,
        () => undefined,
      )

      if (await testShouldOverride()) {
        const resp = await fetchBmclList(ctx).catch(() => undefined)
        if (resp?.ok) {
          ctx.response.status = resp.status
          ctx.response.headers = resp.headers
          ctx.response.body = adaptWebBody(resp.body as any)
        } else {
          const result = await tryScrape()
          ctx.response.status = result ? 200 : 504
          ctx.response.headers = { 'Content-Type': 'application/json' }
          ctx.response.body = JSON.stringify(result ?? { error: 'Timeout' })
        }
        return
      }

      const result = await tryScrape()
      if (result) {
        ctx.response.status = 200
        ctx.response.headers = { 'Content-Type': 'application/json' }
        ctx.response.body = JSON.stringify(result)
      } else {
        ctx.response.status = 504
        ctx.response.headers = { 'Content-Type': 'application/json' }
        ctx.response.body = JSON.stringify({ error: 'Timeout' })
      }
    }
  })
}
