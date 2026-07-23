import type { SharedState } from '../util/SharedState'
import type { CommercialAccountState, CommercialOAuthProvider } from '../entities/commercialAccount'
import type { ServiceKey } from './Service'

export interface CommercialAccountService {
  getCommercialAccountState(): Promise<SharedState<CommercialAccountState>>
  refreshAccount(): Promise<void>
  bootstrapMicrosoft(userId: string): Promise<void>
  bootstrapModrinth(): Promise<void>
  authorizeProvider(provider: Extract<CommercialOAuthProvider, 'google' | 'discord'>): Promise<void>
  prepareMerge(): Promise<void>
  confirmMerge(): Promise<void>
  refreshSession(): Promise<void>
  revokeSession(allDevices?: boolean): Promise<void>
  unlinkIdentity(provider: CommercialOAuthProvider): Promise<void>
  requestDeletion(): Promise<void>
  cancelDeletion(): Promise<void>
}

export const CommercialAccountServiceKey: ServiceKey<CommercialAccountService> = 'CommercialAccountService'
