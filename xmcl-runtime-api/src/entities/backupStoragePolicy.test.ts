import { describe, expect, test } from 'vitest'
import { BACKUP_STORAGE_POLICY_V1 } from './backupStoragePolicy'

describe('BACKUP_STORAGE_POLICY_V1', () => {
  test('defines only the fixed M2-owned free backup capacity policy', () => {
    expect(BACKUP_STORAGE_POLICY_V1).toEqual({
      freeBytes: 1_073_741_824,
      policyVersion: 1,
    })
    expect(Object.keys(BACKUP_STORAGE_POLICY_V1).sort()).toEqual(['freeBytes', 'policyVersion'])
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('accountId')
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('usedBytes')
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('overageBytes')
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('lastSettledAt')
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('settlementIntervalSeconds')
    expect(BACKUP_STORAGE_POLICY_V1).not.toHaveProperty('countedObjects')
  })

  test('is immutable at runtime', () => {
    expect(Object.isFrozen(BACKUP_STORAGE_POLICY_V1)).toBe(true)

    const mutablePolicy = BACKUP_STORAGE_POLICY_V1 as { freeBytes: number }

    expect(() => {
      mutablePolicy.freeBytes = 0
    }).toThrow(TypeError)
    expect(BACKUP_STORAGE_POLICY_V1.freeBytes).toBe(1_073_741_824)
  })
})