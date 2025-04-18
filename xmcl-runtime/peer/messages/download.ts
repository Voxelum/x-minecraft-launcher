import { Writable } from 'stream'
import { defineMessage, MessageType } from './message'

export const MessageShareManifest: MessageType<{}> = 'instance-manifest'
export const MessageGetSharedManifest: MessageType<void> = 'get-instance-manifest'

export const MessageShareManifestEntry = defineMessage(MessageShareManifest, function (msg) {
  const buf = [] as Buffer[]
  this.stream('/sharing', new Writable({
    write: (chunk, encoding, callback) => {
      buf.push(chunk)
      callback()
    },
    destroy: (error, callback) => {
      if (error) {
        this.context.onInstanceShared(this.id, undefined)
      }
      callback()
    },
    final: (callback) => {
      const manifest = JSON.parse(Buffer.concat(buf).toString('utf-8'))
      for (const file of manifest.files) {
        if (file.downloads) {
          file.downloads.push(`peer://${this.id}/sharing/${file.path}`)
        } else {
          file.downloads = [`peer://${this.id}/sharing/${file.path}`]
        }
      }
      this.context.onInstanceShared(this.id, manifest)
      callback()
    }
  }))
})

export const MessageGetSharedManifestEntry = defineMessage(MessageGetSharedManifest, function (msg) {
  this.send(MessageShareManifest, { manifest: this.context.getSharedInstance() })
})
