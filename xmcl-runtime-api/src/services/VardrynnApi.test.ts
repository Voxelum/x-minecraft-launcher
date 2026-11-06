import { describe, expect, it } from 'vitest'
import { parseVardrynnNews, parseVardrynnStatus } from './VardrynnApi'

describe('parseVardrynnStatus', () => {
  it('accepts operational states of the supported version', () => {
    expect(parseVardrynnStatus({ apiVersion: 'v1', state: 'degraded', message: 'Slow' }))
      .toEqual({ state: 'degraded', message: 'Slow' })
  })

  it.each([
    [undefined],
    ['ok'],
    [{ apiVersion: 'v2', state: 'ok' }],
    [{ apiVersion: 'v1', state: 'unconfigured' }],
  ])('treats %j as incompatible', (body) => {
    expect(parseVardrynnStatus(body)).toEqual({ state: 'incompatible' })
  })
})

describe('parseVardrynnNews', () => {
  it('returns no news for another version or shape', () => {
    expect(parseVardrynnNews({ apiVersion: 'v2', items: [{}] })).toEqual([])
    expect(parseVardrynnNews({ apiVersion: 'v1', items: 'none' })).toEqual([])
  })
})
