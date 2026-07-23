import { describe, expect, it } from 'vitest'
import { isValidEmail } from './user'

describe('isValidEmail', () => {
  it('accepts email addresses containing hyphens', () => {
    expect(isValidEmail('first-last@outlook-mail.com')).toBe(true)
  })

  it('rejects malformed email addresses', () => {
    expect(isValidEmail('first-last@outlook')).toBe(false)
  })
})
