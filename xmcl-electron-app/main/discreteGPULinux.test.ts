import { getDiscreteGPUEnvironment, getLinuxGPUProperties } from './discreteGPULinux'
import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('getDiscreteGPUEnvironment', () => {
  it('selects NVIDIA and keeps its offloading variables consistent', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x164e },
      { vendorId: 0x10de, deviceId: 0x2684 },
    ], 'nvidia_optimus')

    expect(env).toEqual({
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
    })
  })

  it('uses dedicated VRAM to select a discrete AMD GPU over an AMD iGPU', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x13c0, deviceString: '' },
      { vendorId: 0x1002, deviceId: 0x7550, deviceString: '' },
    ], undefined, [
      { vendorId: 0x1002, deviceId: 0x13c0, dedicatedMemoryBytes: 512 * 1024 ** 2, bootVga: true },
      { vendorId: 0x1002, deviceId: 0x7550, dedicatedMemoryBytes: 16 * 1024 ** 3, bootVga: false },
    ])

    expect(env).toEqual({ DRI_PRIME: '1002:7550' })
  })

  it('uses local memory to recognize an Intel discrete GPU', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x8086, deviceId: 0x46a6 },
      { vendorId: 0x8086, deviceId: 0x56a0 },
    ], undefined, [
      { vendorId: 0x8086, deviceId: 0x46a6, bootVga: true, dedicatedMemorySource: 'local' },
      { vendorId: 0x8086, deviceId: 0x56a0, dedicatedMemoryBytes: 8 * 1024 ** 3, dedicatedMemorySource: 'vram' },
    ])

    expect(env).toEqual({ DRI_PRIME: '8086:56a0' })
  })

  it('does not set NVIDIA variables when AMD is selected', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x73df, deviceString: 'AMD Radeon RX 6600 XT' },
      { vendorId: 0x8086, deviceId: 0x46a6 },
    ])

    expect(env).toEqual({ DRI_PRIME: '1002:73df' })
  })

  it('does not guess when same-vendor GPUs have indistinguishable evidence', () => {
    const env = getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x1111, deviceString: '' },
      { vendorId: 0x1002, deviceId: 0x2222, deviceString: '' },
    ])

    expect(env).toEqual({})
  })

  it('does not set GPU variables without a detected device', () => {
    expect(getDiscreteGPUEnvironment([])).toEqual({})
  })

  it('does not guess an unknown AMD GPU is discrete', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x164e },
    ])).toEqual({})
  })

  it('does not infer an Intel discrete GPU from shared local memory alone', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x8086, deviceId: 0x46a6 },
    ], undefined, [
      { vendorId: 0x8086, deviceId: 0x46a6, dedicatedMemoryBytes: 8 * 1024 ** 3, dedicatedMemorySource: 'local' },
    ])).toEqual({})
  })

  it('recognizes an Intel Arc GPU by name', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x8086, deviceId: 0x56a0, deviceString: 'Intel(R) Arc(TM) A770' },
    ])).toEqual({ DRI_PRIME: '8086:56a0' })
  })

  it('does not let boot_vga select or reject a GPU', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x13c0, deviceString: '' },
      { vendorId: 0x1002, deviceId: 0x7550, deviceString: '' },
    ], undefined, [
      { vendorId: 0x1002, deviceId: 0x13c0, dedicatedMemoryBytes: 512 * 1024 ** 2, bootVga: false },
      { vendorId: 0x1002, deviceId: 0x7550, dedicatedMemoryBytes: 16 * 1024 ** 3, bootVga: true },
    ])).toEqual({ DRI_PRIME: '1002:7550' })
  })

  it('recognizes Radeon RX Vega as discrete rather than an integrated Vega APU', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x6863, deviceString: 'AMD Radeon RX Vega 56' },
    ])).toEqual({ DRI_PRIME: '1002:6863' })
  })

  it('prefers an NVIDIA discrete GPU over an AMD discrete GPU', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x1002, deviceId: 0x73df, deviceString: 'AMD Radeon RX 6600 XT' },
      { vendorId: 0x10de, deviceId: 0x2684 },
    ])).toEqual({
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
    })
  })

  it('does not suppress NVIDIA detection for duplicate GPU records', () => {
    expect(getDiscreteGPUEnvironment([
      { vendorId: 0x10de, deviceId: 0x2684 },
      { vendorId: 0x10de, deviceId: 0x2684 },
    ])).toEqual({
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
    })
  })
})

describe('getLinuxGPUProperties', () => {
  it('reads PCI IDs, local memory and boot_vga from DRM sysfs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-drm-'))
    const pciDevice = join(root, 'pci-device')
    const drmCard = join(root, 'card0')
    await mkdir(pciDevice)
    await mkdir(drmCard)
    await symlink(pciDevice, join(drmCard, 'device'))
    await writeFile(join(pciDevice, 'vendor'), '0x1002\n')
    await writeFile(join(pciDevice, 'device'), '0x7550\n')
    await writeFile(join(pciDevice, 'mem_info_vram_total'), String(16 * 1024 ** 3))
    await writeFile(join(pciDevice, 'boot_vga'), '0\n')

    try {
      await expect(getLinuxGPUProperties(root)).resolves.toEqual([{
        vendorId: 0x1002,
        deviceId: 0x7550,
        dedicatedMemoryBytes: 16 * 1024 ** 3,
        dedicatedMemorySource: 'vram',
        bootVga: false,
      }])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falls back to local memory when VRAM reports zero', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-drm-local-'))
    const pciDevice = join(root, 'pci-device')
    const drmCard = join(root, 'card0')
    await mkdir(pciDevice)
    await mkdir(drmCard)
    await symlink(pciDevice, join(drmCard, 'device'))
    await writeFile(join(pciDevice, 'vendor'), '0x8086\n')
    await writeFile(join(pciDevice, 'device'), '0x56a0\n')
    await writeFile(join(pciDevice, 'mem_info_vram_total'), '0')
    await writeFile(join(pciDevice, 'lmem_total_bytes'), String(8 * 1024 ** 3))

    try {
      await expect(getLinuxGPUProperties(root)).resolves.toEqual([{
        vendorId: 0x8086,
        deviceId: 0x56a0,
        dedicatedMemoryBytes: 8 * 1024 ** 3,
        dedicatedMemorySource: 'local',
      }])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
