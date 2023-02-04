import { channel } from 'diagnostics_channel'
import { DiagnosticsChannel, Dispatcher } from 'undici'
import { LauncherAppPlugin } from '../app/LauncherApp'

export const pluginUndiciLogger: LauncherAppPlugin = (app) => {
  const undici = app.logManager.openLogger('undici')

  channel('undici:request:create').subscribe((m, name) => {
    const msg: DiagnosticsChannel.RequestCreateMessage = m as any
    undici.log(`request:create ${msg.request.method} ${msg.request.origin}${msg.request.path}`)
  })
  channel('undici:request:bodySent').subscribe((m, name) => {
    const msg: DiagnosticsChannel.RequestBodySentMessage = m as any
    undici.log(`request:bodySent ${msg.request.method} ${msg.request.origin}${msg.request.path}`)
  })
  channel('undici:request:headers').subscribe((m, name) => {
    const msg: DiagnosticsChannel.RequestHeadersMessage = m as any
    undici.log(`request:headers ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.response.statusCode} ${msg.response.headers}`)
  })
  channel('undici:request:trailers').subscribe((m, name) => {
    const msg = m as DiagnosticsChannel.RequestTrailersMessage
    undici.log(`request:trailers ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.trailers}`)
  })
  channel('undici:request:error').subscribe((m, name) => {
    const msg = m as DiagnosticsChannel.RequestErrorMessage
    undici.error(`request:error ${msg.request.method} ${msg.request.origin}${msg.request.path}: %O`, msg.error)
  })
  channel('undici:client:sendHeaders').subscribe((m, name) => {
    const msg: DiagnosticsChannel.ClientSendHeadersMessage = m as any
    undici.log(`client:sendHeaders ${msg.request.method} ${msg.request.origin}${msg.request.path} ${msg.socket.remoteAddress}`)
  })
  channel('undici:client:beforeConnect').subscribe((msg, name) => {
    const m = msg as DiagnosticsChannel.ClientBeforeConnectMessage
    undici.log(`client:beforeConnect ${m.connectParams.protocol}${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername}`)
  })
  channel('undici:client:connectError').subscribe((msg, name) => {
    const m: DiagnosticsChannel.ClientConnectErrorMessage = msg as any
    undici.error(`client:connectError ${m.connectParams.protocol}${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername} %O`, m.error)
  })
  channel('undici:client:connected').subscribe((msg, name) => {
    const m: DiagnosticsChannel.ClientConnectedMessage = msg as any
    undici.log(`client:connected ${m.connectParams.protocol}//${m.connectParams.hostname}:${m.connectParams.port} ${m.connectParams.servername} -> ${m.socket.remoteAddress}`)
  })
  channel('undici:request:cache:headers').subscribe((msg: any, name) => {
    const options = msg.options as Dispatcher.DispatchOptions
    const modified = msg.modified as boolean
    const body = msg.body as boolean
    const precached = msg.precached as boolean
    undici.log(`request:cache:headers ${options.method} ${options.origin}${options.path} modified=${modified} body=${body} precached=${precached}`)
  })
  channel('undici:request:cache:complete').subscribe((msg: any, name) => {
    const options = msg.options as Dispatcher.DispatchOptions
    const skip = msg.skip as boolean
    const storeable = msg.storeable
    undici.log(`request:cache:complete ${options.method} ${options.origin}${options.path} skip=${skip} storeable=${storeable}`)
  })
  channel('undici:request:cache:error').subscribe((msg: any, name) => {
    const options = msg.options as Dispatcher.DispatchOptions
    const skip = msg.skip as boolean
    const storable = msg.storable as boolean
    const retry = msg.retry as boolean
    undici.log(`request:cache:error ${options.method} ${options.origin}${options.path} skip=${skip} storable=${storable} retry=${retry}`)
  })
  channel('undici:request:cache:timeout').subscribe((msg: any, name) => {
    const options = msg.options as Dispatcher.DispatchOptions
    const recovered = msg.recovered
    undici.log(`request:cache:timeout ${options.method} ${options.origin}${options.path} recovered=${recovered}`)
  })
}
