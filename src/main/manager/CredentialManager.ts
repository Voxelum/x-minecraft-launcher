import { AccountInfo, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { Manager } from '.'
import { createPlugin } from '../util/credentialPlugin'
import LauncherApp from '/@main/app/LauncherApp'
import { CLIENT_ID, IS_DEV } from '/@main/constant'

export default class CredentialManager extends Manager {
  readonly scopes: string[]

  private microsoftAccount: Record<string, AccountInfo> = {}

  constructor(app: LauncherApp) {
    super(app)
    this.scopes = ['XboxLive.signin', 'XboxLive.offline_access']
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

  async aquireMicrosoftToken({ username, code, directRedirectToLauncher }: { username: string; code?: string; directRedirectToLauncher?: boolean }) {
    const app = await this.getOAuthApp(username)
    if (username && !code) {
      let account: AccountInfo | undefined
      if (this.microsoftAccount[username]) {
        account = this.microsoftAccount[username]
      } else {
        const accounts = await app.getTokenCache().getAllAccounts().catch(() => [])
        account = accounts.find(a => a.username === username)
      }
      if (account) {
        const result = await app.acquireTokenSilent({ scopes: this.scopes, account }).catch((e) => {
          this.warn(`Fail to aquire microsoft token silently for ${username}`)
          this.warn(e)
          return null
        })
        if (result) {
          return result
        }
      }
    }
    const scopes = this.scopes
    const redirectUri = IS_DEV ? 'http://localhost:3000/auth'
      : directRedirectToLauncher ? 'xmcl://launcher/auth' : 'https://xmcl.vercel.app/auth'
    if (!code) {
      const url = await app.getAuthCodeUrl({
        redirectUri,
        scopes,
        loginHint: username,
      })
      await this.app.openInBrowser(url)
      code = await new Promise<string>((resolve, reject) => {
        if (!IS_DEV) {
          setTimeout(() => { reject(new Error('Timeout to wait the auth code! Please try again later!')) }, 17000)
        }
        this.app.once('microsoft-authorize-code', (err, code) => {
          if (err) {
            reject(err)
          } else {
            resolve(code!)
          }
        })
      })
    }

    const result = await app.acquireTokenByCode({ code, scopes, redirectUri })
    if (username && result?.account) {
      this.microsoftAccount[username] = result?.account
    }
    this.app.controller.requireFocus()
    return result
  }
}
