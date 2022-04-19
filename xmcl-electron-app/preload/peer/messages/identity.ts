import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<{ remoteId: string; name: string; avatar: string }> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  this.setRemoteIdentity(info.remoteId, info.name, info.avatar)
})
