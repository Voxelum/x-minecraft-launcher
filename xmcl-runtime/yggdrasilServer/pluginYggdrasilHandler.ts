import { AUTHORITY_DEV } from '@xmcl/runtime-api'
import { YggdrasilTexture, YggdrasilTexturesInfo } from '@xmcl/user'
import { sign } from 'crypto'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import { LauncherAppPlugin } from '~/app'
import { kPeerFacade } from '~/peer'
import { UserService } from '~/user'

export const pluginYggdrasilHandler: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('YggdrasilServer')

  const getProfile = async (name: string) => {
    const userService = await app.registry.get(UserService)
    const peerService = await app.registry.get(kPeerFacade)
    const offline = Object.values(userService.state.users).find(v => v.authority === AUTHORITY_DEV)
    if (offline) {
      const profiles = Object.values(offline.profiles)
      const founded = profiles.find(p => p.name === name || p.id === name || p.id.replaceAll('-', '') === name)
      if (founded) {
        return founded
      }
    }
    const founded = await peerService.queryGameProfile(name)
    if (founded) {
      return founded
    }
    return undefined
  }

  const queryProfile = async (id: string, needSign?: boolean) => {
    const profile = await getProfile(id)
    logger.log(`Get profile for ${id}: %o`, profile)

    const addr = `http://localhost:${await app.serverPort}/yggdrasil`
    const transformTexture = (text?: YggdrasilTexture) => {
      if (!text) return text
      return { ...text, url: `${addr}/textures?href=${encodeURIComponent(text.url)}` }
    }
    if (profile) {
      const textureInfo: YggdrasilTexturesInfo = {
        timestamp: Date.now(),
        profileId: profile.id,
        profileName: profile.name,
        textures: {
          SKIN: transformTexture(profile.textures.SKIN),
          CAPE: transformTexture(profile.textures.CAPE),
          ELYTRA: transformTexture(profile.textures.ELYTRA),
        },
      }
      logger.log(`Transform texture info for ${id}: %o`, textureInfo)
      const textureString = Buffer.from(JSON.stringify(textureInfo)).toString('base64')
      const signature = needSign
        ? await new Promise<Buffer>((resolve, reject) => {
          sign('RSA-SHA1', Buffer.from(textureString), PRIV, (e, d) => {
            if (e) reject(e)
            else resolve(d)
          })
        })
        : undefined
      const transformed = {
        id: profile.id,
        name: profile.name,
        properties: [
          { name: 'uploadableTextures', value: 'skin,cape' },
          {
            name: 'textures',
            value: textureString,
            signature: signature?.toString('base64'),
          },
        ],
      }
      logger.log(`Encode profile for ${id}: %o`, transformed)
      transformed.id = id
      return JSON.stringify(transformed)
    }
    return undefined
  }

  app.protocol.registerHandler('xmcl', async ({ request, response, handle }) => {
    if (request.url.pathname.startsWith('/yggdrasil')) {
      logger.log(`Process ${request.url.toString()}`)
      const pathname = request.url.pathname.substring('/yggdrasil'.length) || ''
      if (pathname === '/' || pathname === '') {
        response.status = 200
        response.body = JSON.stringify({
          meta: {
            implementationName: 'xmcl-offline-server',
            implementationVersion: '0.0.1',
            serverName: 'X Minecraft Launcher Offline Server',
          },
          skinDomains: [
            'localhost',
          ],
          signaturePublickey: PUB,
        })
      } else if (pathname === '/sessionserver/session/minecraft/join' && request.method === 'POST') {
        if (request.body instanceof Readable) {
          await finished(request.body)
        }
        response.status = 240
      } else if (pathname.startsWith('/sessionserver/session/minecraft/hasJoined') && request.method === 'GET') {
        const username = request.url.searchParams.get('username')!
        try {
          const payload = await queryProfile(username)
          if (payload) {
            response.status = 200
            response.headers = {
              'content-type': 'application/json',
            }
            response.body = payload
          } else {
            response.status = 204
          }
        } catch {
          response.status = 204
        }
      } else if (pathname.startsWith('/sessionserver/session/minecraft/profile/')) {
        const uuid = pathname.substring(pathname.lastIndexOf('/') + 1)
        const needSigned = request.url.searchParams.get('unsigned') === 'false'

        await queryProfile(uuid, needSigned).then((payload) => {
          if (payload) {
            response.headers['content-type'] = 'application/json'
            response.status = 200
            response.body = payload
          } else {
            response.status = 204
          }
        }, () => {
          response.status = 204
        })
      } else if (pathname.startsWith('/textures')) {
        const target = request.url.searchParams.get('href')
        if (!target) {
          logger.log(`Not found texture: ${target}`)
          response.status = 400
        } else {
          logger.log(`Delegate texture request: ${target}`)
          // delegate to other handler
          await handle({
            request: {
              headers: request.headers,
              body: request.body,
              method: request.method,
              url: new URL(target),
            },
            response,
            handle,
          })

          logger.log(`Get response from delegate: ${response.status} %o`, response.headers)
        }
      } else {
        logger.log(`Not found route: ${pathname}`)
        response.status = 404
      }
    }
  })
}

const PUB = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0IkXN4USVBJvzrA3vi8y
ANUEUh9PMmPSWwFS5JccwlDZvw5ymMPuB8S69d6p4I8Ij6lkQkg8izTr3njJ4Z5k
elDH+zClzv/LuYnEvUzaA0aGwHoH4sDUeUm34bK44By/6/ZoImKfDJmjfN/0lEOQ
wZJL1vtDNAseSkZRPxUgBydhVqNBX9SYSfl2M5CBz8QHRe8hCI3QAMaFfqDu3uTJ
0lPJ1HZRCTXHAMgiB2ArdgtU7rx1emga/o8Dx3LU/lV+FuKM94xaRFSreMZWluz1
EjGcsC6je1Ah89aO0jYIHlOxzc1LB2uZaWryBaZ86uxL7EA7qyZG+mV6Y0sq7lSm
UOYQiPInkHfEYrj+VA2gLZPP7mlNv8Xlo5cDvEaQL5Z8vOoB4xi8cY8vXSmAOR5g
eNtkm0NXT5GbZgP1NkkgFhnE4NUrjO44TzjC5enI9wfe0pOZY0k4bHY6crQwL9Rc
tLSHz321FnYF85+yPZWU3DhsGnmfGV9rJJ2h/Fr3k85iD/0ohyWDneZECOsP2EKH
6+L5JEcnejfvQW5S2s0M50np86Pu5gZ+c1pWTWomv5LgwFvARDRu1uFICh1RiCsv
x6Ww85HYoQ8dJMiVIDMLe4+Zzext+08u2dM86/Mwpj/1yBzGTBw2t8y/2j8OWYi9
h57uqbTpmpcI8dftnJdl3osCAwEAAQ==
-----END PUBLIC KEY-----`

const PRIV = `-----BEGIN PRIVATE KEY-----
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
kFD4vQNojkO8caKjNI1ojGzl9BpEFYuk
-----END PRIVATE KEY-----`
