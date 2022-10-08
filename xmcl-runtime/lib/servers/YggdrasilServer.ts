import { GameProfileAndTexture } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { createPrivateKey, sign } from 'crypto'
import { createReadStream } from 'fs'
import { createServer } from 'http'
import { pipeline } from 'stream/promises'
import { request } from 'undici'
import { fileURLToPath } from 'url'

export async function createOfflineYggdrasilServer(getProfile: (username: string) => GameProfileAndTexture | undefined) {
  const priv = createPrivateKey(`-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`)
  const pub = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAs3QRN1DkbjXwBgsBpmsK
1083yWyRpqEfAC88vj50SOXL0PZYG6f0YSc57cQPaRDkpReFVOspVHNuR+uGhk0E
yOTbkGsUWll3Fkacl72ma2kuFn6+0ambO9BBWBmu1yfZtVNDt7roY/0nA2h/FFem
qnXVhfzP13xkJby6LkfFbyipNR7ZuR12SOVIR2+YrLH4n+07zIMfILVnL2Lp8lLP
xAbkdg9N8OTvys6/ijO3nVVVYPw429wNAhqL+i+Nw9h0/YBzB+nhJdLPk6DCAnIh
bbOQNK7hAVW8WQhJVphWL1jMM/osiYj4uQclKchabc9Bz8jTfbz60iPybCXu46uE
MavifAgdhtFEjmHLUp8s78qviHDDvrY08Rha0E6dsOdNvPh21o7Q5ggC879FNUxH
sVq0gGQuZGQhDgAnGHjIKOHSdYO81F06EH/wUG/AAgwKnBHHS9uUKKPWBks5tsg7
hoNgSLLmerFGEEAd2qtZGjw1QJqXXl/0RnEXOXywpGCOOflkNdu+ZTkqQoBW6nb9
itRM66irmTOZ4q4K6SBaPSsdgAAJAPTcokgL5z3zndK+QyGVxIBKesWaE3RyT6M1
YhT3zvsnj+fPWIj/FyEkoLu1YpIh6dmzn3pW5zMaLc9e8UY9KGJS+OuE/mJyktyJ
PlKRbsvxPVEPJ6KkLAgRqX0CAwEAAQ==
-----END PUBLIC KEY-----`
  const queryProfile = async (id: string, needSign?: boolean) => {
    const profile = getProfile(id)

    const addr = `http://localhost:${(server.address() as any).port}`
    const transformTexture = (text?: GameProfile.Texture) => {
      if (!text) return text
      if (text.url.startsWith('image:') || text.url.startsWith('file:')) {
        return { ...text, url: `${addr}/textures?href=${text.url}` }
      }
      return text
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
      const transformed: GameProfile = {
        id: profile.id,
        name: profile.name,
        properties: {
          textures: Buffer.from(JSON.stringify(textureInfo)).toString('base64'),
          uploadableTextures: 'skin,cape',
        },
      }
      const properties: Array<{ name: string; value: string; signature?: string }> = []
      if (transformed.properties) {
        for (const [k, v] of Object.entries(transformed.properties)) {
          if (needSign && k === 'textures') {
            const signature = sign('SHA1', Buffer.from(v, 'base64'), priv).toString('base64')
            properties.push({
              name: k,
              value: v,
              signature,
            })
          } else {
            properties.push({
              name: k,
              value: v,
            })
          }
        }
      }
      return JSON.stringify({ name: transformed.name, id: transformed.id, properties })
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
        signaturePublickey: pub,
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
        res.statusCode = 200
        res.write(payload)
        res.end()
      }, () => {
        res.statusCode = 204
        res.end()
      })
    } else if (req.url?.startsWith('/sessionserver/session/minecraft/profile/')) {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const uuid = url.pathname.substring(url.pathname.lastIndexOf('/') + 1)
      const needSigned = url.searchParams.get('unsigned') === 'false'

      queryProfile(uuid, needSigned).then((payload) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.write(payload)
        res.end()
      }, () => {
        res.statusCode = 204
        res.end()
      })
    } if (req.url?.startsWith('/textures')) {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const target = url.searchParams.get('href')
      if (target?.startsWith('file:') || target?.startsWith('image:')) {
        const url = target.replace('image:', 'file:')
        try {
          res.statusCode = 200
          pipeline(createReadStream(fileURLToPath(url)), res)
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
