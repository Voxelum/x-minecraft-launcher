import { readdir, readFile, realpath } from 'node:fs/promises'

interface GPUDevice {
  vendorId: number
  deviceId: number
  deviceString?: string
}

export interface LinuxGPUProperties {
  vendorId: number
  deviceId: number
  /** Total dedicated/local video memory, in bytes, when exposed by the driver. */
  dedicatedMemoryBytes?: number
  /** True when the reported local-memory value came from dedicated/laptop VRAM sysfs. */
  dedicatedMemorySource?: 'vram' | 'local'
  /** Whether firmware selected this adapter as the boot/display adapter. */
  bootVga?: boolean
}

const DISCRETE_NAME_HINTS = [
  'geforce', 'nvidia', 'rtx', 'gtx', 'radeon rx', 'radeon pro', 'radeon instinct',
]
const INTEGRATED_NAME_HINTS = [
  'uhd graphics', 'hd graphics', 'iris', 'radeon graphics', 'radeon 610m',
  'radeon 680m', 'radeon 760m', 'radeon 780m', 'radeon 860m',
  'radeon 880m', 'radeon 890m',
]

function normalizeGPUName(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''
}

function hasDiscreteGPUName(vendorId: number, name: string) {
  if (vendorId === 0x8086) {
    // Arc branding also covers integrated GPUs (e.g. Arc 140V). Require a
    // discrete model token such as Arc A770, Arc A370M or Arc Pro B50.
    return /\barc(?: (?:r|tm|pro))* [ab]\d{2,3}m?\b/.test(name)
  }
  return DISCRETE_NAME_HINTS.some(keyword => name.includes(keyword))
}

function parseHexFile(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number.parseInt(value.trim().replace(/^0x/i, ''), 16)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function readOptional(path: string) {
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch {
    return undefined
  }
}

/**
 * Read GPU identity and memory information from Linux DRM sysfs.
 * Electron's basic GPUInfo omits device names and PCI addresses, so the
 * sysfs values are matched to Electron devices by PCI vendor/device ID.
 */
export async function getLinuxGPUProperties(sysfsRoot = '/sys/class/drm'): Promise<LinuxGPUProperties[]> {
  let entries: string[]
  try {
    entries = await readdir(sysfsRoot)
  } catch {
    return []
  }

  const result: LinuxGPUProperties[] = []
  for (const entry of entries) {
    if (!/^card\d+$/.test(entry)) continue

    try {
      const devicePath = await realpath(`${sysfsRoot}/${entry}/device`)
      const [vendor, device, memory, localMemory, bootVga] = await Promise.all([
        readOptional(`${devicePath}/vendor`),
        readOptional(`${devicePath}/device`),
        readOptional(`${devicePath}/mem_info_vram_total`),
        readOptional(`${devicePath}/lmem_total_bytes`),
        readOptional(`${devicePath}/boot_vga`),
      ])
      const vendorId = parseHexFile(vendor)
      const deviceId = parseHexFile(device)
      if (vendorId === undefined || deviceId === undefined) continue

      const parsedVram = memory ? Number.parseInt(memory, 10) : undefined
      const parsedLocalMemory = localMemory ? Number.parseInt(localMemory, 10) : undefined
      const validVram = parsedVram !== undefined && Number.isFinite(parsedVram) && parsedVram > 0
        ? parsedVram
        : undefined
      const validLocalMemory = parsedLocalMemory !== undefined && Number.isFinite(parsedLocalMemory) && parsedLocalMemory > 0
        ? parsedLocalMemory
        : undefined
      const dedicatedMemory = validVram !== undefined && validLocalMemory !== undefined
        ? Math.max(validVram, validLocalMemory)
        : validVram ?? validLocalMemory
      const dedicatedMemorySource = validVram !== undefined
        ? 'vram'
        : validLocalMemory !== undefined
          ? 'local'
          : undefined
      result.push({
        vendorId,
        deviceId,
        ...(dedicatedMemory !== undefined
          ? { dedicatedMemoryBytes: dedicatedMemory }
          : {}),
        ...(dedicatedMemorySource !== undefined
          ? { dedicatedMemorySource }
          : {}),
        ...(bootVga === '0' || bootVga === '1' ? { bootVga: bootVga === '1' } : {}),
      })
    } catch {
      // A DRM card can disappear while probing, or may not expose PCI sysfs data.
    }
  }
  return result
}

function getDedicatedMemory(properties: LinuxGPUProperties[], device: GPUDevice) {
  return properties
    .filter(p => p.vendorId === device.vendorId && p.deviceId === device.deviceId)
    .reduce((largest, p) => Math.max(largest, p.dedicatedMemoryBytes ?? 0), 0)
}

function getDedicatedMemorySource(properties: LinuxGPUProperties[], device: GPUDevice) {
  return properties
    .filter(p => p.vendorId === device.vendorId && p.deviceId === device.deviceId)
    .find(p => p.dedicatedMemoryBytes !== undefined && p.dedicatedMemorySource !== undefined)
    ?.dedicatedMemorySource
}

export function getDiscreteGPUEnvironment(
  devices: GPUDevice[],
  multiGpuStyle?: string,
  linuxProperties: LinuxGPUProperties[] = [],
) {
  const isSwitchableSystem = multiGpuStyle === 'nvidia_optimus' || multiGpuStyle === 'amd_switchable'
  const uniqueDevices = [...new Map(
    devices.map(device => [`${device.vendorId}:${device.deviceId}`, device]),
  ).values()]
  const ranked = uniqueDevices.map((device) => {
    let score = 0
    const name = normalizeGPUName(device.deviceString)

    // Names, when available, are the strongest portable classification signal.
    if (hasDiscreteGPUName(device.vendorId, name)) score += 100
    if (INTEGRATED_NAME_HINTS.some(keyword => name.includes(keyword))) score -= 100

    // Linux DRM exposes local/dedicated memory for AMD and many Intel drivers.
    // A multi-gigabyte local-memory region is a strong discrete-GPU signal.
    const dedicatedMemory = getDedicatedMemory(linuxProperties, device)
    const dedicatedMemorySource = getDedicatedMemorySource(linuxProperties, device)
    if (device.vendorId === 0x8086 && dedicatedMemorySource !== 'vram') {
      // Intel lmem_total_bytes can describe shared system memory, so it is not
      // evidence that an Intel GPU is discrete.
    } else if (dedicatedMemory >= 4 * 1024 ** 3) score += 80
    else if (dedicatedMemory >= 1024 ** 3) score += 50
    else if (dedicatedMemory > 0) score += 10

    // Nvidia is the only vendor that is safe to prefer from vendor identity
    // alone: PRIME offload variables are explicit and vendor-specific.
    if (device.vendorId === 0x10de) score += 200

    if (
      isSwitchableSystem
      && device.vendorId !== 0x8086
      && (
        device.vendorId === 0x10de
        || hasDiscreteGPUName(device.vendorId, name)
        || dedicatedMemory >= 1024 ** 3
      )
    ) {
      score += 5
    }

    return { device, score }
  }).sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best) return {}

  // If multiple adapters have identical evidence, don't let Electron's array
  // ordering decide which GPU gets selected. Leave the system default intact.
  if (ranked.length > 1 && ranked[1].score === best.score) return {}

  const gpu = best.device
  const name = normalizeGPUName(gpu.deviceString)
  const dedicatedMemory = getDedicatedMemory(linuxProperties, gpu)
  const dedicatedMemorySource = getDedicatedMemorySource(linuxProperties, gpu)
  const hasDiscreteName = hasDiscreteGPUName(gpu.vendorId, name)
  const hasIntegratedName = INTEGRATED_NAME_HINTS.some(keyword => name.includes(keyword))
  if (gpu.vendorId === 0x8086 && !hasDiscreteName && dedicatedMemorySource !== 'vram') {
    return {}
  }

  // One GPU is not necessarily discrete. Requiring explicit evidence avoids
  // applying DRI_PRIME to an ordinary AMD or Intel integrated adapter.
  if (
    gpu.vendorId !== 0x10de
    && !hasDiscreteName
    && dedicatedMemory < 1024 ** 3
    && !(isSwitchableSystem && gpu.vendorId !== 0x8086)
  ) {
    return {}
  }
  if (hasIntegratedName && dedicatedMemory < 1024 ** 3 && !hasDiscreteName) return {}

  const env: Record<string, string> = {}
  if (gpu.vendorId === 0x10de) {
    env.__NV_PRIME_RENDER_OFFLOAD = '1'
    env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia'
    env.__VK_LAYER_NV_optimus = 'NVIDIA_only'
  } else {
    env.DRI_PRIME = `${gpu.vendorId.toString(16)}:${gpu.deviceId.toString(16)}`
  }
  return env
}
