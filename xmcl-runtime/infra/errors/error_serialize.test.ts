import { describe, expect, it } from 'vitest'
import { getSerializedError } from './error_serialize'

describe('getSerializedError', () => {
  it('preserves the runtime stack, cause, and safe service metadata', async () => {
    const cause = new TypeError('invalid response')
    const error = Object.assign(new Error('service failed', { cause }), {
      code: 'EFAIL',
    })

    await expect(
      getSerializedError(error, {
        origin: 'runtime-service',
        serviceName: 'ExampleService',
        serviceMethod: 'run',
        remoteStack: error.stack,
      }),
    ).resolves.toMatchObject({
      name: 'Error',
      message: 'service failed',
      stack: error.stack,
      remoteStack: error.stack,
      code: 'EFAIL',
      origin: 'runtime-service',
      serviceName: 'ExampleService',
      serviceMethod: 'run',
      cause: {
        name: 'TypeError',
        message: 'invalid response',
        stack: cause.stack,
      },
    })
  })
})
