import { UpnpUnmapOptions } from '@xmcl/nat-api'
import { MappingInfo, UpnpMapOptions } from '@xmcl/runtime-api'
import { Logger } from '~/logger'
import { NatService } from '~/nat'

export function parseCandidate(candidate: string) {
  // a=candidate:6 1 UDP 1686108927 120.245.66.237 11675 typ srflx raddr 0.0.0.0 rport 0
  candidate = candidate.substring('a=candidate:'.length)
  const parts = candidate.split(' ')
  const [foundation, componentId, transport, priority, ip, port, type, ...rest] = parts
  const isIPV4 = ip.indexOf(':') === -1
  if (isIPV4) return [ip, port]
  return [undefined, undefined]
}

export async function mapLocalPort(natService: NatService, ip: string, priv: number, pub: number, logger: Logger) {
  if (!await natService.isSupported()) return false
  const mappings = [{
    description: `XMCL Multiplayer - udp - ${priv} - ${pub}`,
    protocol: 'udp',
    private: priv,
    public: pub,
    ttl: 24 * 60 * 60,
  }, {
    description: `XMCL Multiplayer - tcp - ${priv} - ${pub}`,
    protocol: 'tcp',
    private: priv,
    public: pub,
    ttl: 24 * 60 * 60,
  }] as UpnpMapOptions[]

  const currentMappings = await natService.getMappings()
  const existedMappings = currentMappings.filter(m => m.description.indexOf('XMCL Multiplayer') !== -1 &&
    m.private.port === priv &&
    m.private.host === ip &&
    m.public.port === pub &&
    m.enabled)

  if (existedMappings.length > 0) {
    logger.log('Reuse the existed upnp mapping %o', existedMappings)
    return true
  }

  try {
    await Promise.all(mappings.map(n => natService.map(n)))
  } catch (e) {
    const err = e as any
    if (err.detail?.UPnPError && err.detail?.UPnPError.errorCode === 501) {
      // Table is full
      const candidates = getUnmapCandidates(currentMappings, mappings)
      for (const c of candidates) {
        await natService.unmap(c).catch(() => {})
      }
      await Promise.all(mappings.map(n => natService.map(n)))
    } else if (err.detail?.UPnPError && err.detail.UPnPError.errorCode === 718) {
      // Conflict
      const candidates = getUnmapCandidates(currentMappings, mappings)
      for (const c of candidates) {
        await natService.unmap(c).catch(() => {})
      }
      await Promise.all(mappings.map(n => natService.map(n)))
    } else {
      throw e
    }
  }
}

function getUnmapCandidates(existedMappings: MappingInfo[], candidates: UpnpMapOptions[]) {
  const unmapOptions: UpnpUnmapOptions[] = []
  let count = candidates.length
  for (let i = 0; i < existedMappings.length && count > 0; i++) {
    const mapping = existedMappings[i]
    if (mapping.description.startsWith('BJSDK') || mapping.description.startsWith('HCDN')) {
      unmapOptions.push({
        protocol: mapping.protocol,
        public: mapping.public,
      })

      count--
    }
  }

  return unmapOptions
}
