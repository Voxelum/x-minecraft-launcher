import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<ConnectionUserInfo> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  // if (info.avatar.startsWith('image:')) {
  //   // image protocol
  //   info.avatar = `image://peer/${this.id}/${new URL(info.avatar).pathname}`
  // }
  // if (info.textures.SKIN.url.startsWith('image:')) {
  //   info.textures.SKIN.url = `image://peer/${this.id}/${new URL(info.textures.SKIN.url).pathname}`
  // }
  this.host.onIdentity(this.id, info)
})
