import { GameProfileAndTexture } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { createReadStream } from 'fs'
import { createServer } from 'http'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { request } from 'undici'
import { fileURLToPath } from 'url'

export function createOfflineYggdrasilServer(getProfile: (username: string) => Promise<GameProfileAndTexture | undefined>, imageRoot: string) {
  const queryProfile = async (id: string, needSign?: boolean) => {
    const profile = await getProfile(id)

    const addr = `http://localhost:${(server.address() as any).port}`
    const transformTexture = (text?: GameProfile.Texture) => {
      if (!text) return text
      return { ...text, url: `${addr}/textures?href=${encodeURIComponent(text.url)}` }
    }
    if (profile) {
      const textureInfo: GameProfile.TexturesInfo = {
        timestamp: Date.now(),
        profileId: profile.id,
        profileName: profile.name,
        textures: {
          SKIN: transformTexture(profile.textures.SKIN),
          CAPE: transformTexture(profile.textures.CAPE),
          ELYTRA: transformTexture(profile.textures.ELYTRA),
        },
      }
      const textureBuf = Buffer.from(JSON.stringify(textureInfo))
      const transformed = {
        id: profile.id,
        name: profile.name,
        properties: [
          { name: 'uploadableTextures', value: 'skin,cape' },
          { name: 'textures', value: textureBuf.toString('base64') },
        ],
      }
      return JSON.stringify(transformed)
    }
    return undefined
  }
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.statusCode = 200
      res.write(JSON.stringify({
        meta: {
          implementationName: 'xmcl-offline-server',
          implementationVersion: '0.0.1',
          serverName: 'X Minecraft Launcher Offline Server',
        },
        skinDomains: [
          'localhost',
        ],
      }))
      res.end()
    } else if (req.url === '/sessionserver/session/minecraft/join' && req.method === 'POST') {
      const buf = [] as Buffer[]
      req.on('data', (b) => { buf.push(b) })
      req.on('end', () => {
        res.writeHead(204, 'No Content')
        res.end()
      })
    } else if (req.url?.startsWith('/sessionserver/session/minecraft/hasJoined') && req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const username = url.searchParams.get('username')!
      queryProfile(username).then((payload) => {
        if (payload) {
          res.setHeader('content-type', 'application/json')
          res.statusCode = 200
          res.write(payload)
          res.end()
        } else {
          res.statusCode = 204
          res.end()
        }
      }, () => {
        res.statusCode = 204
        res.end()
      })
    } else if (req.url?.startsWith('/sessionserver/session/minecraft/profile/')) {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const uuid = url.pathname.substring(url.pathname.lastIndexOf('/') + 1)
      const needSigned = url.searchParams.get('unsigned') === 'false'

      queryProfile(uuid, needSigned).then((payload) => {
        if (payload) {
          res.setHeader('content-type', 'application/json')
          res.statusCode = 200
          res.write(payload)
          res.end()
        } else {
          res.statusCode = 204
          res.end()
        }
      }, () => {
        res.statusCode = 204
        res.end()
      })
    } else if (req.url?.startsWith('/textures')) {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const target = url.searchParams.get('href')
      if (target?.startsWith('file:')) {
        const url = target.replace('image:', 'file:')
        try {
          res.statusCode = 200
          pipeline(createReadStream(fileURLToPath(url)), res)
        } catch {
          res.statusCode = 404
          res.end()
        }
      } else if (target?.startsWith('image:')) {
        try {
          res.statusCode = 200
          pipeline(createReadStream(join(imageRoot, target.substring('image://'.length))), res)
        } catch {
          res.statusCode = 404
          res.end()
        }
      } else if (target?.startsWith('http')) {
        request(target).then(rres => {
          res.statusCode = rres.statusCode
          for (const [k, v] of Object.entries(rres.headers)) {
            res.setHeader(k, v ?? '')
          }
          rres.body.pipe(res)
        })
      } else {
        res.statusCode = 404
        res.end()
      }
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  return server
}
