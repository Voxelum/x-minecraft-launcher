import Controller from '@/Controller'
import { PeerService, UserService } from '@xmcl/runtime'
import { RTCSessionDescription } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import debounce from 'lodash.debounce'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
// @ts-ignore
import htmlUrl from '../assets/peer.html'
import { ControllerPlugin } from './plugin'
import peerPreload from '@preload/peer'
import { AbortableTask } from '@xmcl/task'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

export const peerPlugin: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    const browser = new BrowserWindow({
      title: 'Peer Helper',
      webPreferences: {
        preload: peerPreload,
      },
      show: false,
    })

    this.app.log('Create peer window')
    browser.loadFile(htmlUrl)
    this.setupBrowserLogger(browser, 'peer')

    browser.webContents.on('console-message', (event, level, message, line, sourceId) => {
      this.app.log(`[Peer] ${message}`)
    })

    class DownloadPeerFileTask extends AbortableTask<boolean> {
      constructor(readonly url: string, readonly destination: string, readonly sha1: string) {
        super()
        this._to = destination
        this._from = url
      }

      protected async process(): Promise<boolean> {
        const result = await invoke<boolean>('download', {
          url: this.url,
          destination: this.destination,
          sha1: this.sha1,
        })
        return result
      }

      protected abort(isCancelled: boolean): void {
        invoke('download-abort', { url: this.url })
      }

      protected isAbortedError(e: any): boolean {
        return false
      }
    }

    // browser.webContents.openDevTools()

    // browser.show()

    const peerService = this.app.serviceManager.getOrCreateService(PeerService)

    const setLocalDescription = debounce((payload) => {
      pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
        peerService.state.connectionLocalDescription({ id: payload.session, description: compressed })
      })
    })

    ipcMain
      .on('localDescription', async (event, payload) => {
        setLocalDescription(payload)
      })
      .on('connectionstatechange', (event, { id, state }) => {
        peerService.state.connectionStateChange({ id: id, connectionState: state })
      })
      .on('icegatheringstatechange', (event, { id, state }) => {
        peerService.state.iceGatheringStateChange({ id: id, iceGatheringState: state })
      })
      .on('signalingstatechange', (event, { id, state }) => {
        peerService.state.signalingStateChange({ id: id, signalingState: state })
      })
      .on('identity', (event, { id, info }) => {
        peerService.state.connectionUserInfo({ id, info })
      })
      .on('connection', (event, { id }) => {
        peerService.state.connectionAdd({
          id,
          initiator: true,
          userInfo: {
            name: '',
            avatar: '',
          },
          signalingState: 'closed',
          localDescriptionSDP: '',
          iceGatheringState: 'new',
          connectionState: 'new',
          sharing: undefined,
        })
      })
      .on('shared-instance-manifest', (event, { id, manifest }) => {
        peerService.state.connectionShareManifest({ id, manifest })
      })

    ipcMain.handle('get-user-info', () => {
      const user = this.app.serviceManager.getOrCreateService(UserService).state.user
      const profile = user.profiles[user.selectedProfile]
      return { name: profile.name, avatar: profile.textures.SKIN.url }
    })

    let invocationId = 0
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
        browser.webContents.send(method, id, ...args)
      })
    }

    const decode = async (description: string) => {
      return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
    }

    this.app.on('peer-join', async ({ description, type }) => {
      if (type === 'offer') {
        const offer = await decode(description)
        invoke<string>('offer', offer)
      } else {
        const answer = await decode(description)
        invoke('answer', answer)
      }
    })

    peerService.setDelegate({
      async create(): Promise<string> {
        const id = randomUUID()
        await invoke('create', id)
        return id
      },
      async initiate(id: string): Promise<void> {
        await invoke<RTCSessionDescription>('initiate', id)
      },
      async offer(offer: string): Promise<string> {
        const o = await decode(offer)
        const id = await invoke<string>('offer', o)
        return id
      },
      async answer(answer: string): Promise<void> {
        const a = await decode(answer)
        await invoke<void>('answer', a)
      },
      async drop(id: string): Promise<void> {
        await invoke<void>('drop', id)
        peerService.state.connectionDrop(id)
      },
      async downloadTask(url, destination, sha1) {
        return new DownloadPeerFileTask(url, destination, sha1)
      },
      async shareInstance(options) {
        await invoke('share', options.manifest)
      },
    })
  })
}
