import { MojangChallenge, MojangChallengeResponse } from '@xmcl/user'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

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
  'microsoft-authorize-code': [any, string]
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
  setName(name: string): Promise<void>
  getNameChangeInformation(): Promise<NameChangeInformation>
  checkNameAvailability(name: string): Promise<NameAvailability>
  hideCape(): Promise<void>
  showCape(capeId: string): Promise<void>
  verifySecurityLocation(): Promise<boolean>
  getSecurityChallenges(): Promise<MojangChallenge[]>
  submitSecurityChallenges(answers: MojangChallengeResponse[]): Promise<void>
}

export const OfficialUserServiceKey: ServiceKey<OfficialUserService> = 'OfficialUserService'
