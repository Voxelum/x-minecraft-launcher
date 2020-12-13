import { AccountInfo, PublicClientApplication } from '@azure/msal-node';
import LauncherApp from '@main/app/LauncherApp';
import { CLIENT_ID, IS_DEV } from '@main/constant';
import { Manager } from '.';

export default class CredentialManager extends Manager {
    readonly oauth: PublicClientApplication;

    readonly scopes: string[];

    private microsoftAccount: Record<string, AccountInfo> = {};

    // private accountInfoPath = '';

    constructor(app: LauncherApp) {
        super(app);
        this.oauth = new PublicClientApplication({
            auth: {
                authority: 'https://login.microsoftonline.com/consumers/',
                clientId: CLIENT_ID,
            },
            cache: {
            },
        });
        this.scopes = ['XboxLive.signin', 'XboxLive.offline_access'];
    }

    async setup() {
        // const accountInfo = join(this.app.appDataPath, 'account_info.json');
        // this.microsoftAccount = await readJSON(accountInfo).catch(() => undefined);
        // this.accountInfoPath = accountInfo;
    }

    async aquireMicrosoftToken({ username, code, directRedirectToLauncher }: { username?: string; code?: string; directRedirectToLauncher?: boolean } = {}) {
        if (username && this.microsoftAccount[username] && !code) {
            const result = await this.oauth.acquireTokenSilent({ scopes: this.scopes, account: this.microsoftAccount[username] }).catch((e) => {
                this.warn(`Fail to aquire microsoft token silently for ${username}`);
                this.warn(e);
                return null;
            });
            if (result) {
                return result;
            }
        }
        const scopes = this.scopes;
        const redirectUri = IS_DEV ? 'http://localhost:3000/auth'
            : directRedirectToLauncher ? 'xmcl://launcher/auth' : 'https://xmcl.vercel.app/auth';
        if (!code) {
            const url = await this.oauth.getAuthCodeUrl({
                redirectUri,
                scopes,
                loginHint: username,
            });
            await this.app.openInBrowser(url);
            code = await new Promise<string>((resolve, reject) => {
                if (!IS_DEV) {
                    setTimeout(() => { reject(new Error('Timeout to wait the auth code! Please try again later!')); }, 17000);
                }
                this.app.once('microsoft-authorize-code', (err, code) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(code!);
                    }
                });
            });
        }

        const result = await this.oauth.acquireTokenByCode({ code, scopes, redirectUri });
        if (username && result?.account) {
            this.microsoftAccount[username] = result?.account;
            // if (this.microsoftAccount) {
            //     writeJson(this.accountInfoPath, this.microsoftAccount).catch((e) => {
            //         this.error(`Fail to save the microsoft account info to ${this.accountInfoPath}`);
            //         this.error(e);
            //     });
            // }
        }
        this.app.controller.requireFocus();
        return result;
    }
}
