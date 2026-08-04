import { describe, expect, test } from 'vitest'
import { formatProxy, parseProxy } from './setting'

describe('proxy settings', () => {
  test('parses an http proxy into host and port', () => {
    expect(parseProxy('http://127.0.0.1:7890')).toEqual({
      host: '127.0.0.1',
      port: '7890',
    })
  })

  test('keeps a pasted protocol when formatting the proxy', () => {
    expect(formatProxy('http://127.0.0.1:7890', '')).toBe('http://127.0.0.1:7890')
    expect(formatProxy('https://proxy.example', '8443')).toBe('https://proxy.example:8443')
  })

  test('formats the split host and port fields', () => {
    expect(formatProxy('127.0.0.1', '7890')).toBe('http://127.0.0.1:7890')
    expect(formatProxy('', '')).toBe('')
  })
})