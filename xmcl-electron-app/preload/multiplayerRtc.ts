import { hostBrowserRtc } from '@xmcl/runtime/peer/BrowserRtcHost'
import { browserRtcAttachChannel } from '@xmcl/runtime/peer/BrowserRtcProtocol'
import { ipcRenderer } from 'electron/renderer'

const control = new MessageChannel()
ipcRenderer.postMessage(browserRtcAttachChannel, undefined, [control.port1])
hostBrowserRtc(control.port2)
