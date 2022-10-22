import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<ConnectionUserInfo> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  this.host.onIdentity(this.id, info)
})
