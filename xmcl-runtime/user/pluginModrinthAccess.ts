import type { LauncherAppPlugin } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { UserService } from './UserService'

export const pluginModrinthAccess: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ModrinthAccess')

  const userService = await app.registry.get(UserService)
  const credentials = await app.registry.getOrCreate(ExternalCredentialService)

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
      userService.emit('modrinth-authorize-code', error, code)
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

    const token = await credentials.getValidAccessToken('modrinth')
    if (token.status === 'valid') {
      // Modrinth's API accepts both `Bearer <token>` and the raw token; we
      // use the raw form to match the original behavior.
      request.headers['Authorization'] = token.accessToken
    }
  })
}
