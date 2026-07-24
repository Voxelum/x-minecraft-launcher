import { LauncherApp } from '~/app'
import { AnyError } from '@xmcl/utils'
import { UserService } from '../UserService'
import { fetch as undiciFetch } from 'undici'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { resolveXmclApiBaseUrl } from '~/app/xmclApiBaseUrl'

interface ModrinthOAuthResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export async function getModrinthAccessToken(
  app: LauncherApp,
  credentials?: ExternalCredentialService,
) {
  const service = credentials ?? (await app.registry.getOrCreate(ExternalCredentialService))
  const result = await service.getValidAccessToken('modrinth')
  return result.status === 'valid' ? result.accessToken : undefined
}

export async function loginModrinth(app: LauncherApp, userService: UserService, scopes: string[], invalidate: boolean, signal?: AbortSignal, credentials?: ExternalCredentialService) {
  const credentialService = credentials ?? (await app.registry.getOrCreate(ExternalCredentialService))
  const token = invalidate ? undefined : await getModrinthAccessToken(app, credentialService)

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
    const authUrl = new URL(
      '/modrinth/auth',
      resolveXmclApiBaseUrl('https://xmcl-web-api.cijhn.workers.dev', app.getLogger('ApiBaseUrl')),
    )
    authUrl.searchParams.set('code', code)
    authUrl.searchParams.set('redirect_uri', redirect_uri)
    const response = await app.fetch(authUrl)
    if (!response.ok) {
      throw new AnyError('ModrinthAuthError', `Failed to get auth code: ${response.statusText}: ${await response.text()}`)
    }
    const data = await response.json() as ModrinthOAuthResponse
    const issuedAt = Date.now()
    await credentialService.store('modrinth', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scopes: data.scope?.split(' ').filter(Boolean) ?? scopes,
      issuedAt,
      expiresAt: typeof data.expires_in === 'number' ? issuedAt + data.expires_in * 1_000 : undefined,
      providerMetadata: data.token_type ? { tokenType: data.token_type } : undefined,
    })
  }
}
