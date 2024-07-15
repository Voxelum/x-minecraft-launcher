import { DownloadOptions } from '@xmcl/file-transfer'
import { GameProfileAndTexture } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { InjectionKey } from '~/app'

export interface PeerServiceFacade {
  queryGameProfile(name: string): Promise<GameProfileAndTexture | undefined>
  createDownloadOptions(url: string, destination: string, sha1: string, size?: number): DownloadOptions
}

export const kPeerFacade: InjectionKey<PeerServiceFacade> = Symbol('PeerService')
