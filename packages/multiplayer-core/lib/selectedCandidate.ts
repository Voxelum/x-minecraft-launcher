import type { SelectedCandidateInfo } from '@xmcl/runtime-api'

interface CandidatePair {
  local: SelectedCandidateInfo
  remote: SelectedCandidateInfo
}

type RawCandidate = {
  address?: unknown
  ip?: unknown
  port?: unknown
  type?: unknown
  candidateType?: unknown
  transportType?: unknown
  protocol?: unknown
}

export async function getSelectedCandidatePair(
  connection: RTCPeerConnection,
): Promise<CandidatePair | undefined> {
  const nativePair = (
    connection as RTCPeerConnection & {
      selectedCandidatePair?(): { local: RawCandidate; remote: RawCandidate } | null
    }
  ).selectedCandidatePair?.()
  if (nativePair) {
    const local = normalizeCandidate(nativePair.local)
    const remote = normalizeCandidate(nativePair.remote)
    if (local && remote) return { local, remote }
  }

  const stats = await connection.getStats() as unknown as {
    values(): IterableIterator<Record<string, any>>
    get(id: string): Record<string, any> | undefined
  }
  let selectedPair: Record<string, any> | undefined
  for (const report of stats.values()) {
    if (report.type === 'transport' && typeof report.selectedCandidatePairId === 'string') {
      selectedPair = stats.get(report.selectedCandidatePairId)
      break
    }
  }
  if (!selectedPair) {
    for (const report of stats.values()) {
      if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
        selectedPair = report
        break
      }
    }
  }
  if (!selectedPair) return undefined
  const local = normalizeCandidate(stats.get(selectedPair.localCandidateId))
  const remote = normalizeCandidate(stats.get(selectedPair.remoteCandidateId))
  return local && remote ? { local, remote } : undefined
}

function normalizeCandidate(candidate: RawCandidate | undefined): SelectedCandidateInfo | undefined {
  if (!candidate) return undefined
  const address = candidate.address ?? candidate.ip
  const port = Number(candidate.port)
  if (typeof address !== 'string' || !Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    return undefined
  }
  const rawType = candidate.candidateType ?? candidate.type
  const type = rawType === 'host' || rawType === 'prflx' || rawType === 'srflx' || rawType === 'relay'
    ? rawType
    : 'host'
  const rawTransport = candidate.transportType ?? candidate.protocol
  return {
    address,
    port,
    type,
    transportType: rawTransport === 'tcp' ? 'tcp' : 'udp',
  }
}
