import { Authority, ClientAuthErrorCodes, createClientAuthError } from '@azure/msal-common';
import { LauncherAppPlugin } from '~/app';
import { kClientToken } from '~/clientToken';
import { UserService } from './UserService';
import { YggdrasilSeriveRegistry, kYggdrasilSeriveRegistry } from './YggdrasilSeriveRegistry';
import { YggdrasilAccountSystem, kYggdrasilAccountSystem } from './accountSystems/YggdrasilAccountSystem';
import { YggdrasilOCIDAuthClient } from './accountSystems/YggdrasilOCIDAuthClient';
import { kUserTokenStorage } from './userTokenStore';

export const pluginYggdrasilApi: LauncherAppPlugin = async (app) => {
  Object.defineProperty(Authority.prototype, 'deviceCodeEndpoint', {
    get: function (this: Authority) {
      // @ts-ignore
      const metadata = this.metadata as any
      if (metadata.device_authorization_endpoint) {
        // @ts-ignore
        return this.replacePath(metadata.device_authorization_endpoint)
      }
      if (metadata.authorization_endpoint.endsWith("/device_code")) {
        // @ts-ignore
        return this.replacePath(metadata.authorization_endpoint)
      }
      if (this.discoveryComplete()) {
        // @ts-ignore
        return this.replacePath(
          // @ts-ignore
          this.metadata.token_endpoint.replace("/token", "/devicecode")
        );
      } else {
        throw createClientAuthError(
          ClientAuthErrorCodes.endpointResolutionError
        );
      }
    }
  })

  const clientToken = await app.registry.get(kClientToken)
  const logger = app.getLogger('YggdrasilService')
  const tokenStorage = await app.registry.get(kUserTokenStorage)

  const yggReg = new YggdrasilSeriveRegistry(app)
  await yggReg.load()

  const yggdrasilAccountSystem = new YggdrasilAccountSystem(
    app,
    logger,
    clientToken,
    tokenStorage,
    yggReg,
    new YggdrasilOCIDAuthClient(
      (...args) => app.fetch(...args),
      logger,
      (response) => {
        userSerivce.emit('device-code', response)
        app.shell.openInBrowser(response.verificationUri + '?user_code=' + response.userCode)
      },
      app.secretStorage,
    )
  )
  app.registry.register(kYggdrasilAccountSystem, yggdrasilAccountSystem)
  app.registry.register(kYggdrasilSeriveRegistry, yggReg)

  const userSerivce = await app.registry.get(UserService)
}