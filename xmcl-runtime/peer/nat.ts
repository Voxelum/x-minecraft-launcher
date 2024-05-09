import { PeerState, createPromiseSignal } from '@xmcl/runtime-api'
import { UnblockedNatInfo, getNatInfoUDP, sampleNatType } from '@xmcl/stun-client'

export async function raceNatType(state: PeerState, iceServers: RTCIceServer[]) {
  console.log('Start to sample the nat type')
  const stuns = iceServers.map(ice => ice.urls).flat().map(s => s.startsWith('stun:') ? s.slice(5) : s)

  const winner = createPromiseSignal<{ stun: string; info: UnblockedNatInfo }>()
  const all = Promise.all(stuns.map(async (stun) => {
    console.log(`Testing nat type with ${stun}`)
    const info = await getNatInfoUDP({ stun })
    console.log(`Nat type test result ${stun}: %o`, info)
    if (info.type !== 'Blocked') {
      winner.resolve({ info, stun })
    }
  }))
  const winOrBlocked = await Promise.race([winner.promise, all])
  if (winOrBlocked instanceof Array) {
    // All blocked
    state.natTypeSet(state.ips.length > 0 ? 'Symmetric NAT' : 'Blocked')
    console.log('All nat type test failed')
  } else {
    const { info, stun } = winOrBlocked
    state.natTypeSet(info.type)
    console.log('Fast nat detection: %o', info)

    const result = await sampleNatType({
      sampleCount: 3,
      retryInterval: 3_000,
      stun,
    })
    if (result && result !== 'Blocked') {
      state.natTypeSet(result)
    }
    console.log(`Refresh nat type ${result}`)
  }
}
