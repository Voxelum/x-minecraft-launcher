import { OfficialUserService as IOfficialUserService, OfficialUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { MojangChallengeResponse, MojangClient } from '@xmcl/user'
import { LauncherApp, LauncherAppKey, Inject } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { UserTokenStorage, kUserTokenStorage } from '~/user'
import { AnyError } from '../util/error'

const UserAuthenticationError = AnyError.make('UserAuthenticationError')

@ExposeServiceKey(OfficialUserServiceKey)
export class OfficialUserService extends AbstractService implements IOfficialUserService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kUserTokenStorage) private userTokenStorage: UserTokenStorage,
    @Inject(MojangClient) private mojangApi: MojangClient) {
    super(app)
  }

  async setName(user: UserProfile, name: string) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.setName(name, token)
  }

  async getNameChangeInformation(user: UserProfile) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    const result = await this.mojangApi.getNameChangeInformation(token)
    return result
  }

  async checkNameAvailability(user: UserProfile, name: string) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    const result = await this.mojangApi.checkNameAvailability(name, token)
    return result
  }

  async hideCape(user: UserProfile) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.hideCape(token)
  }

  async showCape(user: UserProfile, capeId: string) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    await this.mojangApi.showCape(capeId, token)
  }

  async verifySecurityLocation(user: UserProfile) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.verifySecurityLocation(token)
  }

  async getSecurityChallenges(user: UserProfile) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.getSecurityChallenges(token)
  }

  async submitSecurityChallenges(user: UserProfile, answers: MojangChallengeResponse[]) {
    const token = await this.userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError()
    }
    return await this.mojangApi.submitSecurityChallenges(answers, token)
  }
}
