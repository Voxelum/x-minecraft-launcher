interface GPUDevice {
  vendorId: number
  deviceId: number
  deviceString?: string
}

export function getDiscreteGPUEnvironment(devices: GPUDevice[], multiGpuStyle?: string) {
  const isSwitchableSystem = multiGpuStyle === 'nvidia_optimus' || multiGpuStyle === 'amd_switchable'
  const gpus = devices
    .map((device) => {
      let score = 10
      if (device.vendorId === 0x10de) {
        score = 100
      } else if (device.vendorId === 0x1002) {
        score = 50
      } else if (device.vendorId === 0x8086) {
        score = 0
      }

      if (isSwitchableSystem && device.vendorId !== 0x8086) {
        score += 30
      }

      const name = device.deviceString?.toLowerCase() ?? ''
      const discreteKeywords = ['rtx', 'gtx', 'radeon rx', 'radeon pro', 'geforce rtx']
      const integratedKeywords = ['intel', 'hd graphics', 'uhd graphics', 'iris xe', 'radeon graphics']
      if (discreteKeywords.some(keyword => name.includes(keyword))) {
        score += 20
      }
      if (integratedKeywords.some(keyword => name.includes(keyword))) {
        score -= 10
      }

      return { device, score }
    })
    .sort((a, b) => b.score - a.score)

  const gpu = gpus[0]?.device
  if (!gpu) return {}

  const env: Record<string, string> = {}
  if (gpu.vendorId === 0x10de) {
    env.__NV_PRIME_RENDER_OFFLOAD = '1'
    env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia'
  } else {
    env.DRI_PRIME = `${gpu.vendorId.toString(16)}:${gpu.deviceId.toString(16)}`
  }
  return env
}
