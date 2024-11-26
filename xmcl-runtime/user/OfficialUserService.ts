import { OfficialUserService as IOfficialUserService, OfficialUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { MojangChallengeResponse, MojangClient } from '@xmcl/user'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kUserTokenStorage } from '~/user'
import { AnyError } from '../util/error'

const UserAuthenticationError = AnyError.make('UserAuthenticationError')

@ExposeServiceKey(OfficialUserServiceKey)
export class OfficialUserService extends AbstractService implements IOfficialUserService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(MojangClient) private mojangApi: MojangClient) {
    super(app)
  }

  async setName(user: UserProfile, name: string) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.setName(name, token)
  }

  async getNameChangeInformation(user: UserProfile) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    const result = await this.mojangApi.getNameChangeInformation(token)
    return result
  }

  async checkNameAvailability(user: UserProfile, name: string) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    const result = await this.mojangApi.checkNameAvailability(name, token)
    return result
  }

  async hideCape(user: UserProfile) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.hideCape(token)
  }

  async showCape(user: UserProfile, capeId: string) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.showCape(capeId, token)
  }

  async verifySecurityLocation(user: UserProfile) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.verifySecurityLocation(token)
  }

  async getSecurityChallenges(user: UserProfile) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.getSecurityChallenges(token)
  }

  async submitSecurityChallenges(user: UserProfile, answers: MojangChallengeResponse[]) {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.submitSecurityChallenges(answers, token)
  }
}
