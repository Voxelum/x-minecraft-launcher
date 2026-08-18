import { describe, expect, test } from 'vitest'
import { reinstallDiagnoseOptions } from './reinstallPolicy'

describe('reinstall policy', () => {
  test('requires strict diagnosis without timestamp trust', () => {
    expect(reinstallDiagnoseOptions).toEqual({ strict: true })
    expect('timestamp' in reinstallDiagnoseOptions).toBe(false)
  })
})