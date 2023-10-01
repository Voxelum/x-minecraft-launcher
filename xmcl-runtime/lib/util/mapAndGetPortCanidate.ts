import { UpnpUnmapOptions } from '@xmcl/nat-api'
import { MappingInfo, UpnpMapOptions } from '@xmcl/runtime-api'
import { NatService } from '../services/NatService'
import { Logger } from './log'

export async function mapAndGetPortCandidate(natService: NatService, portCandidate: number, logger: Logger) {
  if (!await natService.isSupported()) return portCandidate

  const mappings = await natService.getMappings()
  console.log(mappings)
  const existedMappings = mappings.filter(m => m.description.indexOf('XMCL Multiplayer') !== -1 && m.enabled)
  const findPorts = () => {
    let candidate = portCandidate
    while (candidate < 60000) {
      if (mappings.some(p => p.public.port === candidate ||
        p.public.port === candidate + 1 ||
        p.public.port === candidate + 2)) {
        // port is occupied
        candidate += 3
      } else {
        // candidate pass
        break
      }
    }
    return [[candidate, candidate], [candidate + 1, candidate + 1], [candidate + 2, candidate + 2]] as const
  }
  if (existedMappings.length > 0) {
    logger.log('Reuse the existed upnp mapping %o', existedMappings)
    portCandidate = existedMappings[0].private.port
  } else {
    const ports = findPorts()
    const candidateMappings: UpnpMapOptions[] = []
    for (const [priv, pub] of ports) {
      candidateMappings.push({
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
      })
    }
    logger.log('Create new upnp mapping %o', candidateMappings)

    try {
      await Promise.all(candidateMappings.map(n => natService.unmap({
        protocol: n.protocol,
        public: n.public,
      })))
      await Promise.all(candidateMappings.map(n => natService.map(n)))
    } catch (e) {
      const err = e as any
      if (err.detail?.UPnPError && err.detail?.UPnPError.errorCode === 501) {
        // Table is full
        const candidates = getUnmapCandidates(mappings, candidateMappings)
        console.log(candidates)
        for (const c of candidates) {
          if (!await natService.unmap(c)) {
            debugger
          }
        }
        // await Promise.all(candidateMappings.map(n => natService.unmap({
        //   protocol: n.protocol,
        //   public: n.public,
        // })))
        console.log(await natService.getMappings())
        await Promise.all(candidateMappings.map(n => natService.map(n)))
      } else {
        throw e
      }
    }

    portCandidate = ports[0][0]
  }
  console.log(await natService.getMappings())
  return portCandidate
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
