import { LauncherAppPlugin } from '~/app'
import { UserService } from './UserService'
import { getModrinthAccessToken } from './loginModrinth'

export const pluginModrinthAccess: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ModrinthAccess')

  const userService = await app.registry.get(UserService)

  app.protocol.registerHandler('xmcl', ({ request, response }) => {
    const parsed = request.url
    if (parsed.host === 'launcher' && parsed.pathname === '/modrinth-auth') {
      let error: Error | undefined
      if (parsed.searchParams.get('error')) {
        const err = parsed.searchParams.get('error')!
        const errDescription = parsed.searchParams.get('error')!
        error = new Error(unescape(errDescription));
        (error as any).error = err
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

    if ( request.url.pathname === '/v2/version_files') {
      return
    }

    const token = await getModrinthAccessToken(app)
    if (token) {
      request.headers['Authorization'] = `Bearer ${token}`
    }
  })
}
