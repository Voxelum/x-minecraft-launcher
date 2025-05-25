import { LauncherApp } from '~/app'
import { AnyError } from '~/util/error'
import { UserService } from './UserService'
import { kGFW } from '~/gfw'

interface ModrinthOAuthResponse {
  access_token: string
  expires_in: number
  token_type: string
}

export async function getModrinthAccessToken(app: LauncherApp) {
  const metadata = await app.secretStorage.get('modrinth', 'MODRINTH_USER')
  try {
    if (metadata) {
      const { access_token, expires_in, token_type } = JSON.parse(metadata) as ModrinthOAuthResponse
      const now = Date.now()
      const expirationTime = now + (expires_in * 1000)
      if (now < expirationTime) {
        return access_token
      } else {
        return false
      }
    }
  } catch (e) {
    return undefined
  }
}

export async function loginModrinth(app: LauncherApp, userService: UserService, scopes: string[], invalidate: boolean, signal?: AbortSignal) {
  const token = invalidate ? undefined : await getModrinthAccessToken(app)

  if (!token) {
    const redirect_uri = `http://127.0.0.1:${await app.serverPort}/modrinth-auth`
    const scopesString = scopes.join(' ')
    const url = new URL('https://modrinth.com/auth/authorize')
    url.searchParams.set('client_id', 'GFz0B21y')
    url.searchParams.set('redirect_uri', redirect_uri)
    url.searchParams.set('scope', scopesString)
    app.shell.openInBrowser(url.toString())
    userService.emit('modrinth-authorize-url', url)
    const code = await new Promise<string>((resolve, reject) => {
      const abort = () => {
        reject(new AnyError('AuthCodeTimeoutError', 'Timeout to wait the auth code! Please try again later!'))
      }
      signal?.addEventListener('abort', abort)
      userService.once('modrinth-authorize-code', (err, code) => {
        app.controller.requireFocus()
        if (err) {
          reject(err)
        } else {
          resolve(code!)
        }
      })
    })
    const gfw = await app.registry.get(kGFW)
    const authUrl = gfw.inside ? new URL('https://xmcl-highfreq-function.azurewebsites.net/api/modrinth-auth') : new URL('https://api.xmcl.app/modrinth/auth')
    authUrl.searchParams.set('code', code)
    authUrl.searchParams.set('redirect_uri', redirect_uri)
    const response = await app.fetch(authUrl)
    if (!response.ok) {
      throw new AnyError('ModrinthAuthError', `Failed to get auth code: ${response.statusText}: ${await response.text()}`)
    }
    const data = await response.json() as ModrinthOAuthResponse

    await app.secretStorage.put('modrinth', 'MODRINTH_USER', JSON.stringify(data))
  }
}
