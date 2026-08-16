import type { SharedState } from '../util/SharedState'
import type { XmclAccountState, XmclOAuthProvider } from '../entities/xmclAccount'
import type { ServiceKey } from './Service'

export type XmclMicrosoftBootstrapResult = 'bootstrapped' | 'pending-consent' | 'not-applicable'

export interface XmclTogetherMoney {
  currency: string
  amountMinor: number
}

export interface XmclTogetherBalance {
  accountId: string
  available: XmclTogetherMoney
  reserved: XmclTogetherMoney
}

export interface XmclTogetherOffer {
  offerId: 'xmcl-plus'
  displayName: string
  monthlyPrice: XmclTogetherMoney
  aiUnitsPerPeriod: number
  turnEgressBytesPerPeriod: number
}

export interface XmclTogetherTrial {
  status: 'available' | 'active' | 'expired' | 'unavailable'
  durationSeconds: number
  turnEgressBytes: number
  claimedAt?: string
  expiresAt?: string
}

export interface XmclTogetherSubscription {
  subscriptionId: string
  accountId: string
  status: 'active' | 'payment_due' | 'cancelled'
  currentPeriodStartedAt: string
  currentPeriodEndsAt: string
  createdAt: string
  updatedAt: string
  cancelAtPeriodEnd?: true
}

export interface XmclTogetherOrder {
  orderId: string
  cashAmount: XmclTogetherMoney
  approvalUrl?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface XmclTogetherOverview {
  offer: XmclTogetherOffer
  trial: XmclTogetherTrial
  subscription: XmclTogetherSubscription | null
  balance: XmclTogetherBalance
}

export interface XmclAccountService {
  getXmclAccountState(): Promise<SharedState<XmclAccountState>>
  refreshAccount(): Promise<void>
  bootstrapMicrosoft(userId: string): Promise<XmclMicrosoftBootstrapResult>
  authorizeMicrosoft(): Promise<void>
  bootstrapModrinth(): Promise<void>
  authorizeProvider(provider: Extract<XmclOAuthProvider, 'google' | 'discord'>): Promise<void>
  prepareMerge(): Promise<void>
  confirmMerge(): Promise<void>
  refreshSession(): Promise<void>
  revokeSession(allDevices?: boolean): Promise<void>
  getTogetherOverview(): Promise<XmclTogetherOverview>
  claimTogetherTrial(): Promise<XmclTogetherTrial>
  createTogetherOrder(amountMinor: number): Promise<XmclTogetherOrder>
  getTogetherOrder(orderId: string): Promise<XmclTogetherOrder>
  subscribeTogether(): Promise<XmclTogetherSubscription>
  cancelTogether(): Promise<XmclTogetherSubscription>
}

export const XmclAccountServiceKey: ServiceKey<XmclAccountService> = 'XmclAccountService'
