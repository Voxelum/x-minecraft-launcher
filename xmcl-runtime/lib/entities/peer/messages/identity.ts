import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<ConnectionUserInfo> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  if (info.avatar.startsWith('image:')) {
    // image protocol
    info.avatar = `peer://${this.id}/image/${new URL(info.avatar).hostname}`
  }
  if (info.textures.SKIN.url.startsWith('image:')) {
    info.textures.SKIN.url = `peer://${this.id}/image/${new URL(info.textures.SKIN.url).hostname}`
  }
  this.host.onIdentity(this.id, info)
})
