import { describe, expect, test } from 'vitest'
import { homedir } from 'os'
import { redactWithHome, redactStack } from './telemetry_redact'

describe('redactWithHome', () => {
  test('replaces windows home path with ~ (backslash form)', () => {
    const stack = `Error: boom\n    at f (C:\\Users\\dev\\AppData\\Roaming\\xmcl\\log.txt:1:1)`
    expect(redactWithHome(stack, 'C:\\Users\\dev')).toBe(
      `Error: boom\n    at f (~\\AppData\\Roaming\\xmcl\\log.txt:1:1)`,
    )
  })

  test('replaces windows home path with ~ (forward slash form)', () => {
    const stack = `at f (C:/Users/dev/AppData/Roaming/xmcl/log.txt:1:1)`
    expect(redactWithHome(stack, 'C:\\Users\\dev')).toBe(
      `at f (~\\AppData\\Roaming\\xmcl\\log.txt:1:1)`.replaceAll('\\', '/'),
    )
  })

  test('replaces POSIX home path with ~', () => {
    const stack = `at f (/home/dev/.xmcl/launcher.log:1:1)`
    expect(redactWithHome(stack, '/home/dev')).toBe(`at f (~/.xmcl/launcher.log:1:1)`)
  })

  test('redacts access tokens', () => {
    expect(redactWithHome('access_token=abc123.DEF', '/home/dev')).toBe('[redacted]')
    expect(redactWithHome('access_token: abc123.DEF', '/home/dev')).toBe('[redacted]')
  })

  test('redacts refresh tokens', () => {
    expect(redactWithHome('refresh_token="xyz-tok-9"', '/home/dev')).toBe('[redacted]')
  })

  test('redacts bearer authorization headers', () => {
    expect(
      redactWithHome('Authorization: Bearer eyJhbGciOi.example.payload', '/home/dev'),
    ).toBe('[redacted]')
  })

  test('redacts client secrets', () => {
    expect(redactWithHome('client_secret=s3cr3t-', '/home/dev')).toBe('[redacted]')
  })

  test('keeps non-path frames unchanged', () => {
    const frame = 'at Object.<anonymous> (/app/dist/index.js:10:15)'
    expect(redactWithHome(frame, '/home/dev')).toBe(frame)
  })

  test('handles empty input', () => {
    expect(redactWithHome('', '/home/dev')).toBe('')
  })
})

describe('redactStack', () => {
  test('redacts the current platform home directory', () => {
    const home = homedir()
    const sep = home.includes('\\') ? '\\' : '/'
    const stack = `Error: fail\n    at f (${home}${sep}sample${sep}file.js:1:1)`
    const result = redactStack(stack)
    expect(result).not.toContain(home)
    expect(result).toContain(`~${sep}sample`)
    expect(result).toContain('Error: fail')
  })
})
