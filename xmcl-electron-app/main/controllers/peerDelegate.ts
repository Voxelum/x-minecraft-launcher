import Controller from '@/Controller'
import peerPreload from '@preload/peer'
import { PeerService, UserService } from '@xmcl/runtime'
import { RTCSessionDescription } from '@xmcl/runtime-api'
import { BrowserWindow, ipcMain } from 'electron'
// @ts-ignore
import htmlUrl from '../assets/peer.html'
import { ControllerPlugin } from './plugin'

export const peerPlugin: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    const peerService = this.app.serviceManager.get(PeerService)

    ipcMain.handle('get-user-info', () => {
      const user = this.app.serviceManager.get(UserService).state.user
      const profile = user?.profiles[user.selectedProfile]
      return { name: profile?.name ?? 'Player', avatar: profile?.textures.SKIN.url ?? '', ...profile }
    })

    let browser: BrowserWindow | undefined
    let invocationId = 0

    const ensureBrowser = async () => {
      if (!browser) {
        browser = new BrowserWindow({
          title: 'Peer Helper',
          webPreferences: {
            preload: peerPreload,
            sandbox: false,
          },
          show: false,
        })

        this.app.log('Create peer window')
        browser.loadFile(htmlUrl)
        this.setupBrowserLogger(browser, 'peer')
        // browser.webContents.on('console-message', (event, level, message, line, sourceId) => {
        //   this.app.log(`[Peer] ${message}`)
        // })
      }
      return browser
    }
    const invoke = <T>(method: string, ...args: any[]) => {
      const id = invocationId++

      return new Promise<T>((resolve, reject) => {
        const handler = (_: any, payload: any) => {
          if (payload.id === id) {
            if (payload.error) {
              reject(payload.error)
            } else {
              resolve(payload.result)
            }
          }
          ipcMain.removeListener(method, handler)
        }
        ipcMain.on(method, handler)
        ensureBrowser().then((browser) => {
          browser.webContents.send(method, id, ...args)
        })
      })
    }

    // peerService.setDelegate({
    //   on(event, handler: (v: any) => void) {
    //     ipcMain.on(event, (e, payload) => {
    //       handler(payload as any)
    //     })
    //     return this
    //   },
    //   create(id: string): Promise<void> {
    //     return invoke('create', id)
    //   },
    //   async initiate(id: string): Promise<void> {
    //     await invoke<RTCSessionDescription>('initiate', id)
    //   },
    //   offer(offer: object): Promise<string> {
    //     return invoke<string>('offer', offer)
    //   },
    //   answer(answer: object): Promise<void> {
    //     return invoke<void>('answer', answer)
    //   },
    //   drop(id: string): Promise<void> {
    //     return invoke<void>('drop', id)
    //   },
    //   downloadAbort(options) {
    //     return invoke('download-abort', options)
    //   },
    //   download(options) {
    //     return invoke<boolean>('download', options)
    //   },
    //   async shareInstance(path, man) {
    //     await invoke('share', path, man)
    //   },
    // })
  })
}
