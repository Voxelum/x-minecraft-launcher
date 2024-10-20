import { ElectronController } from '@/ElectronController'
import optifinePreload from '@preload/optifine'
import { OptifineVersion } from '@xmcl/runtime-api'
import { BrowserWindow } from 'electron'
import { Readable } from 'stream'
import { setTimeout } from 'timers/promises'
import { kGFW } from '~/gfw'
import { kOptifineInstaller } from '~/install'
import { kSettings, shouldOverrideApiSet } from '~/settings'
import { ControllerPlugin } from './plugin'

export const optifine: ControllerPlugin = async function (this: ElectronController) {
  let pooled: BrowserWindow | undefined
  let clearTimeout: AbortController | undefined

  const app = this.app
  const gfw = await this.app.registry.get(kGFW)
  const shouldOverride = testShouldOverride()
  async function testShouldOverride() {
    const setting = await app.registry.get(kSettings)
    const isInside = await gfw.signal === 'cn'
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
      setTimeout(60_000, undefined, { signal: clearTimeout.signal }).then(() => {
        pooled?.close()
        pooled = undefined
      })
    }
  }

  function createBrowserWindow() {
    if (pooled) {
      const current = pooled
      pooled = undefined

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
    win.webContents.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    return win
  }

  async function getDownloads() {
    const win = createBrowserWindow()

    const versions = await new Promise<OptifineVersion[]>((resolve) => {
      win.loadURL('https://optifine.net/downloads')
      win.webContents.once('ipc-message', (ev, channel, ...args) => {
        if (channel === 'optifine-downloads') {
          resolve(args[0])
        }
      })
      win.once('closed', () => {
        resolve([])
      })
    })

    poolWindow(win)

    return versions
  }

  async function getDownloadUrl(version: OptifineVersion) {
    const win = createBrowserWindow()

    const fileName = `OptiFine_${version.mcversion}_${version.type}_${version.patch}.jar`

    const url = await new Promise<string>((resolve) => {
      win.loadURL(`https://optifine.net/adloadx?f=${fileName}`)
      win.webContents.once('ipc-message', (ev, channel, ...args) => {
        if (channel === 'optifine-download') {
          resolve(args[0])
        }
      })
    })

    poolWindow(win)

    return url
  }

  this.app.registry.register(kOptifineInstaller, async (version) => {
    if (await shouldOverride) {
      return getDownloadUrl(version)
    }
    return `https://bmclapi2.bangbang93.com/optifine/${version.mcversion}/${version.type}/${version.patch}`
  })

  this.app.protocol.registerHandler('https', async (ctx) => {
    if (ctx.request.url.toString() === 'https://bmclapi2.bangbang93.com/optifine/versionList') {
      if (await shouldOverride) {
        const result = await Promise.race([getDownloads(), setTimeout(5000)])
        if (!result) {
          ctx.response.status = 400
          ctx.response.headers = {
            'Content-Type': 'application/json',
          }
          ctx.response.body = JSON.stringify({ error: 'Timeout' })
        } else {
          ctx.response.status = 200
          ctx.response.headers = {
            'Content-Type': 'application/json',
          }
          ctx.response.body = JSON.stringify(result)
        }
      } else {
        const body = ctx.request.body
        const resp = await this.app.fetch(ctx.request.url.toString(), {
          headers: ctx.request.headers,
          method: ctx.request.method,
          body: body instanceof Readable ? Readable.toWeb(body) as any : body,
          redirect: 'follow',
        })
        if (resp.ok) {
          ctx.response.status = resp.status
          ctx.response.headers = resp.headers
          ctx.response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body ?? undefined)
        } else {
          const result = await Promise.race([getDownloads(), setTimeout(5000)])
          if (!result) {
            ctx.response.status = resp.status
            ctx.response.headers = resp.headers
            ctx.response.body = resp.body instanceof ReadableStream ? Readable.fromWeb(resp.body as any) : (resp.body ?? undefined)
          } else {
            ctx.response.status = 200
            ctx.response.headers = {
              'Content-Type': 'application/json',
            }
            ctx.response.body = JSON.stringify(result)
          }
        }
      }
    }
  })
}
