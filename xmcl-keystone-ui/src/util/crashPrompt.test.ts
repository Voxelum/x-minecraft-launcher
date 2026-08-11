import { describe, expect, it } from 'vitest'
import { getCrashAgentPrompt, toVirtualInstancePath } from './crashPrompt'

describe('toVirtualInstancePath', () => {
  it('maps an instance-scoped crash report to a virtual crash-reports path', () => {
    expect(toVirtualInstancePath('C:/instances/Test/.minecraft/crash-reports/crash-2024-01-01_00.00.00-client.txt', 'C:/instances/Test')).toBe('crash-reports/crash-2024-01-01_00.00.00-client.txt')
  })

  it('maps a log file under the instance folder to a virtual logs path', () => {
    expect(toVirtualInstancePath('C:/instances/Test/logs/latest.log', 'C:/instances/Test')).toBe('logs/latest.log')
  })

  it('keeps non-instance paths as-is', () => {
    expect(toVirtualInstancePath('/tmp/crash.txt', 'C:/instances/Test')).toBe('/tmp/crash.txt')
  })
})

describe('getCrashAgentPrompt', () => {
  it('points the agent at the evidence for the failed launch', () => {
    const prompt = getCrashAgentPrompt('raw crash', 'raw log', 'crash-reports/test.txt', 'logs/latest.log', 'launch-id')

    expect(prompt).toContain('launch launch-id')
    expect(prompt).toContain('launches/launch-id')
    expect(prompt).not.toContain('logs/latest.log')
    expect(prompt).not.toContain('crash-reports/test.txt')
    expect(prompt).not.toContain('raw crash')
    expect(prompt).not.toContain('raw log')
  })

  it('prefers the virtual path over inline crash content when a file path is available', () => {
    const prompt = getCrashAgentPrompt('raw crash', 'raw log', 'crash-reports/test.txt', 'logs/latest.log')

    expect(prompt).toContain('crash-reports/test.txt')
    expect(prompt).toContain('logs/latest.log')
    expect(prompt).not.toContain('raw crash')
    expect(prompt).not.toContain('raw log')
  })

  it('does not inline captured output when the latest log is available', () => {
    const prompt = getCrashAgentPrompt('large captured crash output', 'large captured log output', undefined, 'logs/latest.log')

    expect(prompt).toContain('- Latest log: logs/latest.log')
    expect(prompt).not.toContain('large captured crash output')
    expect(prompt).not.toContain('large captured log output')
    expect(prompt.length).toBeLessThan(500)
  })
})
