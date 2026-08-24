import type { SharedState } from '../util/SharedState'
import type { XmclAccountState, XmclOAuthProvider } from '../entities/xmclAccount'
import type { ServiceKey } from './Service'

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

export interface XmclTogetherAllowanceSource {
  source: 'plus' | 'shared_hosting'
  referenceId: string
  aiUnits: number
  turnEgressBytes: number
  periodStartedAt: string
  periodEndsAt: string
}

export interface XmclTogetherAllowance {
  included: number
  consumed: number
  remaining: number
  meteringStatus: 'not_configured' | 'active'
}

export interface XmclTogetherAllowances {
  sources: XmclTogetherAllowanceSource[]
  aiUnits: XmclTogetherAllowance
  turnEgressBytes: XmclTogetherAllowance
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
  allowances: XmclTogetherAllowances
  balance: XmclTogetherBalance
}

export interface XmclAccountService {
  getXmclAccountState(): Promise<SharedState<XmclAccountState>>
  refreshAccount(): Promise<void>
  authorizeMicrosoft(): Promise<void>
  authorizeModrinth(): Promise<void>
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
