import { CryptoProvider, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { CLIENT_ID, IS_DEV } from '../constant'
import { UserService } from '../services/UserService'
import { createPlugin } from '../util/credentialPlugin'

export default class CredentialManager extends Manager {
  readonly scopes: string[] = ['XboxLive.signin', 'XboxLive.offline_access']
  readonly extraScopes: string[] = ['user.read']

  private cancelWait = () => { }

  constructor(app: LauncherApp) {
    super(app)
  }

  async setup() {
  }

  protected async getOAuthApp(account: string) {
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: CLIENT_ID,
      },
      cache: {
        cachePlugin: createPlugin('xmcl', account),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Verbose,
          loggerCallback: (level, message, ppi) => {
            this.log(`${message}`)
          },
        },
      },
    })
  }

  cancelMicrosoftTokenRequest() {
    this.cancelWait()
  }

  async acquireMicrosoftToken({ username, code, directRedirectToLauncher }: { username: string; code?: string; directRedirectToLauncher?: boolean }) {
    const app = await this.getOAuthApp(username)
    if (username && !code) {
      const accounts = await app.getTokenCache().getAllAccounts().catch(() => [])
      const account = accounts.find(a => a.username === username)
      if (account) {
        const result = await app.acquireTokenSilent({
          scopes: this.scopes,
          account,
          forceRefresh: false,
        }).catch((e) => {
          this.warn(`Fail to acquire microsoft token silently for ${username}`)
          this.warn(e)
          return null
        })
        const userRead = await app.acquireTokenSilent({
          scopes: this.extraScopes,
          account,
        }).catch((e) => {
          this.warn(`Fail to acquire microsoft token silently for ${username}`)
          this.warn(e)
          return null
        })
        if (result) {
          return {
            xbox: result,
            microsoft: userRead,
          }
        }
      }
    }
    const scopes = this.scopes
    const redirectUri = directRedirectToLauncher || IS_DEV ? 'http://localhost:25555/auth' : 'https://xmcl.app/auth'

    if (!code) {
      const url = await app.getAuthCodeUrl({
        redirectUri,
        scopes,
        extraScopesToConsent: ['user.read'],
        loginHint: username,
      })
      this.app.openInBrowser(url)
      this.app.serviceManager.getOrCreateService(UserService).emit('microsoft-authorize-url', url)
      code = await new Promise<string>((resolve, reject) => {
        this.cancelWait = () => {
          reject(new Error('Timeout to wait the auth code! Please try again later!'))
        }
        this.app.once('microsoft-authorize-code', (err, code) => {
          if (err) {
            reject(err)
          } else {
            resolve(code!)
          }
        })
      }).finally(() => {
        this.cancelWait = () => { }
      })
    }

    const result = await app.acquireTokenByCode({ code, scopes, redirectUri })
    const msResult = await app.acquireTokenSilent({
      account: result!.account!,
      scopes: this.extraScopes,
    })
    this.app.controller.requireFocus()
    return {
      xbox: result,
      microsoft: msResult,
    }
  }
}
