import { createSsdp, UpnpClient } from '@xmcl/nat-api'
import type { NatType } from '@xmcl/runtime-api'
import { type UnblockedNatInfo, getNatInfoUDP, sampleNatType } from '@xmcl/stun-client'

const probeTimeout = 10_000

function timeout<T>(promise: Promise<T>, milliseconds: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('NAT probe timeout')), milliseconds)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function detectNatType(iceServers: RTCIceServer[]): Promise<{
  ips: string[]
  natType: NatType
}> {
  const stuns = iceServers
    .flatMap((ice) => ice.urls)
    .filter((url) => url.startsWith('stun:'))
    .map((url) => url.slice(5))
  if (stuns.length === 0) return { ips: [], natType: 'Unknown' }

  const winner = Promise.withResolvers<{ stun: string; info: UnblockedNatInfo }>()
  const all = Promise.all(stuns.map(async (stun) => {
    try {
      const info = await timeout(getNatInfoUDP({ stun }), probeTimeout)
      if (info.type !== 'Blocked') winner.resolve({ info, stun })
    } catch {}
  }))
  const winOrBlocked = await Promise.race([winner.promise, all])
  if (Array.isArray(winOrBlocked)) return { ips: [], natType: 'Blocked' }

  const { info, stun } = winOrBlocked
  let natType: NatType = info.type
  try {
    const sample = await sampleNatType({ sampleCount: 3, retryInterval: 3_000, stun })
    if (sample && sample !== 'Blocked') natType = sample
  } catch {}
  return { ips: [info.externalIp], natType }
}

async function discoverGateway() {
  try {
    const ssdp = await createSsdp()
    const client = new UpnpClient(ssdp)
    const { device } = await client.findGateway()
    return await device.connectDevice()
  } catch {
    return undefined
  }
}

const gateway = discoverGateway()

export async function getDeviceInfo() {
  return gateway
}
