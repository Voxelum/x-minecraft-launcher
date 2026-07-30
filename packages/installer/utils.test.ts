import { spawn } from 'child_process'
import { describe, expect, it } from 'vitest'
import { ProcessExitError, waitProcess } from './utils'

describe('waitProcess', () => {
  it('preserves a nonzero exit code and bounded stderr', async () => {
    const child = spawn(process.execPath, ['-e', 'process.stderr.write("processor failed"); process.exit(7)'])
    const error = await waitProcess(child).catch((error) => error)

    expect(error).toBeInstanceOf(ProcessExitError)
    expect(error.exitCode).toBe(7)
    expect(error.stderr).toBe('processor failed')
  })
})
