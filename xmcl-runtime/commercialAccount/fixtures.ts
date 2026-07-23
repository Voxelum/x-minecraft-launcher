import type { CommercialAuthResult } from './CommercialAccountApi'

export const M1_SHARED_V1_CONTRACT = {
  contractVersion: 'shared/v1',
  source: 'contracts/shared/v1/fixtures/backup-storage-policy.json',
} as const

export const M1_SHARED_V1_POLICY_FIXTURE = {
  freeBytes: 1_073_741_824,
  policyVersion: 1,
} as const

export const M1_LOCAL_AUTH_FIXTURE: CommercialAuthResult = {
  account: {
    accountId: 'account-fixture',
    status: 'active',
    createdAt: '2026-07-22T00:00:00.000Z',
  },
  identities: [{
    provider: 'modrinth',
    displayName: 'Fixture User',
    linkedBy: 'launcher_bootstrap',
    linkedAt: '2026-07-22T00:00:00.000Z',
  }],
  session: {
    sessionId: 'session-fixture',
    accountId: 'account-fixture',
    accessToken: 'fixture-access-token',
    refreshToken: 'fixture-refresh-token',
    scopes: ['account:read'],
    issuedAt: '2026-07-22T00:00:00.000Z',
    expiresAt: '2026-07-22T01:00:00.000Z',
  },
  bindingDisposition: 'created',
}
