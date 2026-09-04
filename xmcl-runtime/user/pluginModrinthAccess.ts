import { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { UserService } from './UserService'
import { formatModrinthAuthorization } from './utils/loginModrinth'

export const pluginModrinthAccess: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('ModrinthAccess')

  app.protocol.registerHandler('xmcl', ({ request, response }) => {
    const parsed = request.url
    if (parsed.host === 'launcher' && parsed.pathname === '/modrinth-auth') {
      let error: Error | undefined
      if (parsed.searchParams.get('error')) {
        const err = parsed.searchParams.get('error')!
        const errDescription = parsed.searchParams.get('error')!
        error = new Error(unescape(errDescription))
        ;(error as any).error = err
      }
      const code = parsed.searchParams.get('code') as string
      void app.registry.get(UserService)
        .then((userService) => {
          userService.emit('modrinth-authorize-code', error, code)
        })
        .catch(() => {
          logger.warn('Unable to emit Modrinth authorization code.')
        })
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

  app.protocol.registerHandler('https', async ({ request, response }) => {
    if (request.url.host !== 'api.modrinth.com') {
      return
    }

    if (request.url.pathname === '/v2/version_files') {
      return
    }

    const credentials = await app.registry.getOrCreate(ExternalCredentialService)
    const token = await credentials.getValidAccessToken('modrinth')
    if (token.status === 'valid') {
      request.headers['Authorization'] = formatModrinthAuthorization(token.accessToken)
    }
  })
}
