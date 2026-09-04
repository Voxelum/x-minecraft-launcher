import { ipcMain, MessageChannelMain, type WebContents } from 'electron'
import {
  BrowserRtcSession,
  type BrowserPeerConnectionProvider,
} from '@xmcl/runtime/peer/BrowserRtcProvider'
import {
  browserRtcAttachChannel,
  type RtcBridgeMessageChannel,
} from '@xmcl/runtime/peer/BrowserRtcProtocol'

export class BrowserRtcController {
  private ownerId: number | undefined
  private readonly waiters = new Set<{
    resolve(provider: BrowserPeerConnectionProvider): void
    reject(error: Error): void
  }>()
  private session: BrowserRtcSession | undefined

  constructor() {
    ipcMain.on(browserRtcAttachChannel, (event) => {
      const port = event.ports[0]
      if (!port || this.ownerId !== event.sender.id) {
        port?.close()
        return
      }
      this.session?.close()
      const session = new BrowserRtcSession(
        port,
        () => {
          if (this.session === session) this.session = undefined
        },
        createElectronRtcMessageChannel,
      )
      this.session = session
      for (const waiter of this.waiters) waiter.resolve(session.provider)
      this.waiters.clear()
    })
  }

  attach(webContents: WebContents) {
    if (this.ownerId !== webContents.id) this.session?.close()
    this.ownerId = webContents.id
  }

  detach(webContentsId: number) {
    if (this.ownerId !== webContentsId) return
    this.ownerId = undefined
    this.session?.close()
    for (const waiter of this.waiters) waiter.reject(new Error('multiplayer_rtc_provider_closed'))
    this.waiters.clear()
  }

  getProvider() {
    if (this.session) return Promise.resolve(this.session.provider)
    return new Promise<BrowserPeerConnectionProvider>((resolve, reject) => {
      this.waiters.add({ resolve, reject })
    })
  }
}

function createElectronRtcMessageChannel() {
  return new MessageChannelMain() as unknown as RtcBridgeMessageChannel
}