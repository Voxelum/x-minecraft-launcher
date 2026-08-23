import { describe, expect, it } from 'vitest'
import { LaunchException } from '../services/LaunchService'
import { getExceptionName, isException } from './exception'

describe('exception protocol name', () => {
  it('matches serialized launch exceptions after the constructor is renamed', () => {
    class MinifiedLaunchException extends LaunchException {
      static readonly exceptionName = LaunchException.exceptionName
    }

    const serialized = {
      name: 'LaunchException',
      exception: {
        type: 'launchLinuxDisplayUnavailable',
        reason: 'sandbox-denied',
      },
    }

    expect(MinifiedLaunchException.name).not.toBe(serialized.name)
    expect(getExceptionName(MinifiedLaunchException)).toBe(serialized.name)
    expect(isException(MinifiedLaunchException, serialized)).toBe(true)
  })
})