import { MutableState } from '../util/MutableState'
import { GameProfileAndTexture } from '../entities/user.schema'
import { ServiceKey } from './Service'

export class PeerGroupState {
  group = ''
  groupState = 'closed' as 'connecting' | 'closing' | 'closed' | 'connected'

  connectionGroup(group: string) {
    this.group = group
  }

  connectionGroupState(state: 'connecting' | 'closing' | 'closed' | 'connected') {
    this.groupState = state
  }
}

export interface PeerGroupService {
  getGroupState(): Promise<MutableState<PeerGroupState>>
  /**
   * Join a group. Then the group will automatically handle your connection between peers
   */
  joinGroup(id: string, user?: GameProfileAndTexture): Promise<void>
  /**
   * Leave the current group
   */
  leaveGroup(): Promise<void>
}

export const PeerGroupServiceKey: ServiceKey<PeerGroupService> = 'PeerGroupService'
