import { Authentication, ProfileServiceAPI, YggdrasilAuthAPI } from '@xmcl/user'
import { Got } from 'got'

export class YggdrasilClient {
  constructor(
    private request: Got,
    readonly authService: YggdrasilAuthAPI,
    readonly profileService: ProfileServiceAPI) { }

  async authenticate(username: string, password: string, clientToken: string, requestUser = true) {
    const authentication = await this.request.post(this.authService.hostName + this.authService.authenticate, {
      body: {
        agent: { name: 'Minecraft', version: 1 },
        requestUser,
        clientToken,
        username,
        password,
      },
    }).json<Authentication>()

    return authentication
  }

  async refresh(accessToken: string, clientToken: string, requestUser = true) {
    const result = await this.request.post(this.authService.hostName + this.authService.refresh, {
      body: {
        requestUser,
        clientToken,
        accessToken,
      },
    }).json<{ accessToken: string; clientToken: string }>()

    return result
  }

  async validate(accessToken: string, clientToken: string) {
    return await this.request.post(this.authService.hostName + this.authService.validate, {
      body: {
        clientToken,
        accessToken,
      },
    }).json().then(() => true, () => false)
  }

  async invalidate(accessToken: string, clientToken: string) {
    await this.request.post(this.authService.hostName + this.authService.invalidate, {
      body: {
        clientToken,
        accessToken,
      },
    }).json()
  }

  async lookup() { }

  async setTexture() { }
}
