import { describe, expect, it } from 'vitest'
import { buildState, computeLint } from './i18n-core.mjs'

describe('task manager locales', () => {
  it('provides used, compilable task labels and matching parameters in every locale', () => {
    const state = buildState()
    const labels = [
      'task.running', 'task.succeed', 'task.eta', 'task.remaining', 'task.totalRemaining',
      'task.op.update', 'task.op.export', 'task.op.duplicate',
      'shared.download', 'shared.install',
      'duration.second', 'duration.minute', 'duration.hour', 'duration.day',
    ]
    const removed = [
      'task.op.download', 'task.op.install',
      'resourcepack.installed', 'save.installed', 'shaderPack.installed',
    ]
    for (const [locale, keys] of state.localeKeys) {
      for (const key of labels) {
        expect(keys.get(key), `${locale}: ${key}`).toEqual(expect.any(String))
      }
      for (const key of removed) expect(keys.has(key), `${locale}: ${key}`).toBe(false)
    }
    const result = computeLint(state)
    expect(result.invalid.filter(({ key }) => key === null || labels.includes(key))).toEqual([])
    expect(result.warnings.filter(({ key }) => labels.includes(key))).toEqual([])
    expect(result.unused.filter(key => labels.includes(key))).toEqual([])
  })
})
