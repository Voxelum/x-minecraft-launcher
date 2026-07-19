import { getDiscreteGPUEnvironment } from './discreteGPULinux'
import { describe, expect, it } from 'vitest'

describe('getDiscreteGPUEnvironment', () => {
  it('selects NVIDIA and keeps its offloading variables consistent', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x164e },
      { vendorId: 0x10de, deviceId: 0x2684 },
    ], 'nvidia_optimus')

    expect(env).toEqual({
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
    })
  })

  it('does not set NVIDIA variables when AMD is selected', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x73df },
      { vendorId: 0x8086, deviceId: 0x46a6 },
    ])

    expect(env).toEqual({ DRI_PRIME: '1002:73df' })
  })

  it('does not set GPU variables without a detected device', () => {
    expect(getDiscreteGPUEnvironment([])).toEqual({})
  })
})
