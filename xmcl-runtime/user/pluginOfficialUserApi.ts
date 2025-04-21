import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { MicrosoftAuthenticator, MojangClient } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { kNetworkInterface } from '~/network'
import { AnyError } from '../util/error'
import { UserService } from './UserService'
import { MicrosoftAccountSystem } from './accountSystems/MicrosoftAccountSystem'
import { MicrosoftOAuthClient } from './accountSystems/MicrosoftOAuthClient'
import { kUserTokenStorage } from './userTokenStore'

const CLIENT_ID = '1363d629-5b06-48a9-a5fb-c65de945f13e'

export const pluginOfficialUserApi: LauncherAppPlugin = async (app) => {
  app.registry.get(kNetworkInterface).then((networkInterface) => {
  })

  // @ts-ignore
  const mojangApi = new MojangClient({ fetch: (...args) => app.fetch(...args) })
  app.registry.register(MojangClient, mojangApi)

  const logger = app.getLogger('OfficialUserSystem')

  const userService = await app.registry.get(UserService)
  const headers = {}

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
    ), app)

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
}
