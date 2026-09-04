import type {
  Multiplayer,
  MultiplayerInitPayload,
  MultiplayerLogEvent,
  MultiplayerTransport,
  PeerState,
  SharedState,
} from '@xmcl/runtime-api'
import type { InjectionKey } from '~/app'

export type MultiplayerHost = Omit<Multiplayer, 'on' | 'once' | 'removeListener'> &
  Pick<Multiplayer, 'on' | 'once' | 'removeListener'> & {
  readonly closed: Promise<void>
  shareInstance(options: import('@xmcl/runtime-api').ShareInstanceOptions): Promise<void>
  dispose(): Promise<void>
}

export interface MultiplayerHostOptions {
  transport: MultiplayerTransport
  state: SharedState<PeerState>
  init: MultiplayerInitPayload
  log(event: MultiplayerLogEvent): void
  isTelemetryEnabled(): boolean
  getTelemetryAccountId(): string | undefined
  setDownloadPort(port: number): void
}

export type MultiplayerHostFactory = (
  options: MultiplayerHostOptions,
) => Promise<MultiplayerHost>

export const kMultiplayerHostFactory: InjectionKey<MultiplayerHostFactory> =
  Symbol('MultiplayerHostFactory')