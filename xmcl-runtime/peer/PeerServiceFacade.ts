import { GameProfileAndTexture } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export interface PeerServiceFacade {
  queryGameProfile(name: string): Promise<GameProfileAndTexture | undefined>
  getHttpDownloadUrl(url: string): string
}

export const kPeerFacade: InjectionKey<PeerServiceFacade> = Symbol('PeerService')
