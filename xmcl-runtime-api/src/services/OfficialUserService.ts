import { MojangChallenge, MojangChallengeResponse } from '@xmcl/user'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'
import { UserProfile } from '../entities/user.schema'

interface OfficialUserServiceEventMap {
  'microsoft-authorize-url': string
  'device-code': {
    userCode: string
    deviceCode: string
    verificationUri: string
    expiresIn: number
    interval: number
    message: string
  }
}

export interface Skin {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  variant: 'SLIM' | 'CLASSIC'
}
export interface Cape {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  /**
   * Capes name
   */
  alias: string
}

export interface NameChangeInformation {
  changedAt: string
  createdAt: string
  nameChangeAllowed: boolean
}

export enum NameAvailability {
  DUPLICATE = 'DUPLICATE',
  AVAILABLE = 'AVAILABLE',
  NOT_ALLOWED = 'NOT_ALLOWED',
}

export interface MicrosoftMinecraftProfile {
  id: string
  name: string
  skins: Skin[]
  capes: Cape[]
}

export interface OfficialUserService extends GenericEventEmitter<OfficialUserServiceEventMap> {
  setName(userProfile: UserProfile, name: string): Promise<void>
  getNameChangeInformation(userProfile: UserProfile): Promise<NameChangeInformation>
  checkNameAvailability(userProfile: UserProfile, name: string): Promise<NameAvailability>
  hideCape(userProfile: UserProfile): Promise<void>
  showCape(userProfile: UserProfile, capeId: string): Promise<void>
  verifySecurityLocation(userProfile: UserProfile): Promise<boolean>
  getSecurityChallenges(userProfile: UserProfile): Promise<MojangChallenge[]>
  submitSecurityChallenges(userProfile: UserProfile, answers: MojangChallengeResponse[]): Promise<void>
}

export const OfficialUserServiceKey: ServiceKey<OfficialUserService> = 'OfficialUserService'
