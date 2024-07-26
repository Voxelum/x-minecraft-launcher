import { AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserException, UserProfile } from '@xmcl/runtime-api'
import { MicrosoftAuthenticator, MojangClient, YggdrasilClient } from '@xmcl/user'
import { Client } from 'undici'
import { LauncherAppPlugin } from '~/app'
import { kClientToken } from '~/clientToken'
import { kNetworkInterface } from '~/network'
import { AnyError, isSystemError } from '../util/error'
import { toRecord } from '../util/object'
import { UserService } from './UserService'
import { MicrosoftAccountSystem } from './accountSystems/MicrosoftAccountSystem'
import { MicrosoftOAuthClient } from './accountSystems/MicrosoftOAuthClient'
import { normalizeGameProfile } from './user'
import { kUserTokenStorage } from './userTokenStore'

const CLIENT_ID = '1363d629-5b06-48a9-a5fb-c65de945f13e'

export const pluginOfficialUserApi: LauncherAppPlugin = async (app) => {
  app.registry.get(kNetworkInterface).then((networkInterface) => {
  })

  const mojangApi = new MojangClient()
  app.registry.register(MojangClient, mojangApi)

  const logger = app.getLogger('OfficialUserSystem')

  const userService = await app.registry.get(UserService)
  const system = new MicrosoftAccountSystem(logger,
    new MicrosoftAuthenticator({
      fetch: (...args) => app.fetch(...args),
    }),
    mojangApi,
    () => app.registry.get(kUserTokenStorage),
    new MicrosoftOAuthClient(
      (...args) => app.fetch(...args),
      logger,
      CLIENT_ID,
      async (url, signal) => {
        app.shell.openInBrowser(url)
        userService.emit('microsoft-authorize-url', url)
        return await new Promise<string>((resolve, reject) => {
          const abort = () => {
            reject(new AnyError('AuthCodeTimeoutError', 'Timeout to wait the auth code! Please try again later!'))
          }
          (signal as any)?.addEventListener('abort', abort)
          userService.once('microsoft-authorize-code', (err, code) => {
            app.controller.requireFocus()
            if (err) {
              reject(err)
            } else {
              resolve(code!)
            }
          })
        })
      },
      async (directRedirectToLauncher) => {
        const port = await app.serverPort ?? 25555
        directRedirectToLauncher = true // force to use localhost before the website is fixed
        return (directRedirectToLauncher ? `http://localhost:${port}/auth` : `https://xmcl.app/auth?port=${port}`)
      },
      (response) => {
        userService.emit('device-code', response)
        app.shell.openInBrowser(response.verificationUri)
      },
      app.secretStorage,
    ))

  userService.registerAccountSystem(AUTHORITY_MICROSOFT, system)

  app.protocol.registerHandler('xmcl', ({ request, response }) => {
    const parsed = request.url
    if (parsed.host === 'launcher' && parsed.pathname === '/auth') {
      let error: Error | undefined
      if (parsed.searchParams.get('error')) {
        const err = parsed.searchParams.get('error')!
        const errDescription = parsed.searchParams.get('error')!
        error = new Error(unescape(errDescription));
        (error as any).error = err
      }
      const code = parsed.searchParams.get('code') as string
      userService.emit('microsoft-authorize-code', error, code)
      response.status = 200
      try {
        response.body = app.controller.getLoginSuccessHTML()
        response.headers = {
          'Content-Type': 'text/html',
        }
      } catch (e) {
        if (e instanceof Error) {
          logger.error(e)
        }
      }
    }
  })

  const headers = {}
  const legacyClient = new YggdrasilClient('https://authserver.mojang.com', {
    headers,
  })
  userService.registerAccountSystem(AUTHORITY_MOJANG, {
    login: async (options) => {
      const clientToken = await app.registry.get(kClientToken)
      const result = await legacyClient.login({
        username: options.username,
        password: options.password ?? '',
        requestUser: true,
        clientToken,
      })
        .catch((e) => {
          if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
            throw new UserException({ type: 'loginInternetNotConnected' }, e.message)
          } else if (e.error === 'ForbiddenOperationException' &&
            e.errorMessage === 'Invalid credentials. Invalid username or password.') {
            throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
          } else if (e.error === 'ForbiddenOperationException' &&
            e.errorMessage === 'Invalid credential information.') {
            throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
          } else if (isSystemError(e)) {
            if (e.code === 'ETIMEDOUT') {
              throw new UserException({ type: 'loginTimeout' }, e.message)
            } else if (e.code === 'ECONNRESET') {
              throw new UserException({ type: 'loginReset' }, e.message)
            }
          }
          throw new UserException({ type: 'loginGeneral' }, e.message)
        })

      const userProfile: UserProfile = {
        id: result.user!.id,
        username: options.username,
        invalidated: false,
        profiles: toRecord(result.availableProfiles.map(normalizeGameProfile), (v) => v.id),
        selectedProfile: result.selectedProfile?.id ?? '',
        expiredAt: Date.now() + 86400_000,
        authority: options.authority,
      }

      const userTokenStorage = await app.registry.get(kUserTokenStorage)
      await userTokenStorage.put(userProfile, result.accessToken)

      return userProfile
    },
    refresh: async (user) => {
      const clientToken = await app.registry.get(kClientToken)
      const userTokenStorage = await app.registry.get(kUserTokenStorage)
      const token = await userTokenStorage.get(user)
      if (!token) {
        // TODO: error
        return user
      }
      const valid = await legacyClient.validate(token, clientToken)

      logger.log(`Validate ${user.authority} user access token: ${valid ? 'valid' : 'invalid'}`)

      if (valid) {
        return user
      }
      try {
        const result = await legacyClient.refresh({
          accessToken: token,
          requestUser: true,
          clientToken,
        })
        logger.log(`Refreshed user access token for user: ${user.id}`)

        userTokenStorage.put(user, result.accessToken)
        user.expiredAt = Date.now() + 86400_000
      } catch (e) {
        logger.warn(e)
        logger.warn(`Invalid current user ${user.id} accessToken!`)
      }
      return user
    },
    setSkin: system.setSkin.bind(system),
  })
}
