import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { readJson, writeJson } from 'fs-extra'
import type { IceServer } from 'node-datachannel'
import { join } from 'path'
import { request } from 'undici'
import { LauncherAppPlugin } from '~/app'
import { UserService } from '~/user'
import { kIceServerProvider } from '.'

export const pluginIceServers: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('IceServers')
  let iceServers: IceServer[] = []
  const cachePath = join(app.appDataPath, 'ice-servers.json')
  try {
    const caches = await readJson(cachePath).catch(() => ([]))
    if (caches instanceof Array && caches.length > 0) {
      iceServers = caches
    }
  } catch (e) {
    logger.error(e as any)
  }
  app.registry.register(kIceServerProvider, {
    getIceServers: (allowTurn) => allowTurn ? iceServers : iceServers.filter(s => !s.password),
  })
  const userService = await app.registry.get(UserService)
  userService.getUserState().then((state) => {
    state.subscribe('userProfile', (profile) => {
      if (profile.authority === AUTHORITY_MICROSOFT && !iceServers.some(s => s.password)) {
        update()
      }
    })
  })
  const update = async () => {
    if (iceServers.length === 0) {
      const caches = await readJson(cachePath).catch(() => ([]))
      if (caches instanceof Array && caches.length > 0) {
        iceServers = caches
      }
    }

    logger.log('Try to fetch rtc credential')
    const officialAccount = await userService.getOfficialUserProfile()
    const username = officialAccount?.username ?? 'anonymous'
    logger.log(`Use minecraft xbox ${username} to fetch rtc credential`)
    const response = await request('https://api.xmcl.app/rtc/official', {
      method: 'POST',
      headers: officialAccount
        ? {
          authorization: `Bearer ${officialAccount.accessToken}`,
        }
        : undefined,
    })
    if (response.statusCode === 200) {
      const credential: {
        password: string
        username: string
        uris: string[]
        stuns: string[]
      } = await response.body.json() as any
      iceServers = [
        ...credential.uris
          .filter(u => u.startsWith('turn:'))
          .map(u => u.substring('turn:'.length))
          .map(u => {
            const [hostname, port] = u.split(':')
            return {
              username: credential.username,
              password: credential.password,
              hostname,
              port: port ? Number.parseInt(port) : 3478,
              relayType: 'TurnUdp' as any,
            }
          }),
        ...credential.stuns.map((s) => {
          const [hostname, port] = s.split(':')
          return {
            hostname,
            port: port ? Number.parseInt(port) : 3478,
          }
        }),
      ]
      await writeJson(cachePath, iceServers)

      logger.log(`Updated the rtc credential by xbox ${username}.`)
    } else {
      logger.error(new Error(`Fail to fetch the rtc credential by xbox ${username}. Status ${response.statusCode}.`))
    }
  }
}
