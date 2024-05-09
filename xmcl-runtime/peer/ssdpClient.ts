import { createSsdp, UpnpClient, UpnpUnmapOptions, UpnpMapOptions } from '@xmcl/nat-api'

async function create() {
  try {
    const ssdp = await createSsdp()
    const client = new UpnpClient(ssdp)
    const { device, address } = await client.findGateway()
    const info = await device.connectDevice()
    return {
      client,
      info,
      address,
    }
  } catch (e) {
    return undefined
  }
}
const promise = create()

export async function getDeviceInfo() {
  return promise.then((v) => v?.info, () => undefined)
}

export async function getNatAddress() {
  return promise.then((v) => v?.address.address, () => undefined)
}

export function isSupported() {
  return promise.then(() => true, () => false)
}

export async function getMappings() {
  try {
    const client = await promise
    return client?.client.getMappings() || []
  } catch (e) {
    return []
  }
}

export async function map(options: UpnpMapOptions) {
  const client = await promise.then(c => c?.client)
  await client?.map(options)
}

export async function unmap(options: UpnpUnmapOptions) {
  const client = await promise.then(c => c?.client)
  return await client?.unmap(options)
}
