import { ConnectionUserInfo } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageIdentity: MessageType<ConnectionUserInfo> = 'identity'

export const MessageIdentityEntry = defineMessage(MessageIdentity, function (info) {
  const tranform = (url: string) => {
    if (url.startsWith('http://launcher/image')) {
      return `peer://${this.id}/image/${url.substring('http://launcher/image/'.length)}`
    }
    return url
  }
  info.avatar = tranform(info.avatar)
  info.textures.SKIN.url = tranform(info.textures.SKIN.url)
  if (info.textures.CAPE) {
    info.textures.CAPE.url = tranform(info.textures.CAPE.url)
  }
  if (info.textures.ELYTRA) {
    info.textures.ELYTRA.url = tranform(info.textures.ELYTRA.url)
  }
  this.context.onIdentity(this.id, info)
})
