import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<{ remoteId: string } & ConnectionUserInfo> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  this.setRemoteIdentity(info.remoteId, info)
})
