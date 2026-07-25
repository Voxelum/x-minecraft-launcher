import type { SharedState } from '../util/SharedState'
import type { XmclAccountState, XmclOAuthProvider } from '../entities/xmclAccount'
import type { ServiceKey } from './Service'

export type XmclMicrosoftBootstrapResult = 'bootstrapped' | 'pending-consent' | 'not-applicable'

export interface XmclAccountService {
  getXmclAccountState(): Promise<SharedState<XmclAccountState>>
  refreshAccount(): Promise<void>
  bootstrapMicrosoft(userId: string): Promise<XmclMicrosoftBootstrapResult>
  bootstrapModrinth(): Promise<void>
  authorizeProvider(provider: Extract<XmclOAuthProvider, 'google' | 'discord'>): Promise<void>
  prepareMerge(): Promise<void>
  confirmMerge(): Promise<void>
  refreshSession(): Promise<void>
  revokeSession(allDevices?: boolean): Promise<void>
}

export const XmclAccountServiceKey: ServiceKey<XmclAccountService> = 'XmclAccountService'
