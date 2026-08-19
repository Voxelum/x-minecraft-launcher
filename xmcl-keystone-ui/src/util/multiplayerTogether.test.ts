import { describe, expect, it } from 'vitest'
import {
  getTogetherRecommendationAction,
  hasLongConnectionProblem,
  isProblematicNatType,
  isWaffoCheckoutUrl,
  mergeRoomPeerConnections,
  shouldRecommendTogether,
  updateConnectionProblemSince,
} from './multiplayerTogether'

function member(peerId: string, status: 'negotiating' | 'connected', joinedAt: number) {
  return { peerId, status, joinedAt, accountId: peerId, displayName: peerId }
}

describe('Together peer list', () => {
  it('attaches a room connection to its member instead of adding a duplicate row', () => {
    const self = member('self', 'connected', 1_000)
    const master = member('master', 'connected', 2_000)
    const masterConnection = { id: 'master-session', remoteId: 'master' }

    const peers = mergeRoomPeerConnections([self, master], [masterConnection])

    expect(peers).toHaveLength(2)
    expect(peers[0]).toMatchObject({ key: 'self', member: self })
    expect(peers[1]).toEqual({
      key: 'master',
      member: master,
      connection: masterConnection,
    })
  })

  it('keeps manual connections that are not room members', () => {
    const manualConnection = { id: 'manual-session', remoteId: 'manual-peer' }

    const peers = mergeRoomPeerConnections([member('self', 'connected', 1_000)], [manualConnection])

    expect(peers).toHaveLength(2)
    expect(peers[1]).toEqual({
      key: 'manual-peer',
      connection: manualConnection,
    })
  })
})

describe('Together connection warning', () => {
  it('classifies NAT conditions that commonly require a relay', () => {
    expect(isProblematicNatType('Symmetric NAT')).toBe(true)
    expect(isProblematicNatType('Symmetric UDP Firewall')).toBe(true)
    expect(isProblematicNatType('Blocked')).toBe(true)
    expect(isProblematicNatType('Restrict Port NAT')).toBe(false)
    expect(isProblematicNatType('Unknown')).toBe(false)
  })

  it('counts initial negotiation from the room join time', () => {
    const problemSince = new Map<string, number>()
    updateConnectionProblemSince(
      problemSince,
      [{ member: member('peer', 'negotiating', 1_000), connectionState: 'connecting' }],
      40_000,
    )

    expect(problemSince.get('peer')).toBe(1_000)
    expect(hasLongConnectionProblem(problemSince, 16_000, 15_000)).toBe(true)
  })

  it('starts a fresh timer when a previously connected peer disconnects', () => {
    const problemSince = new Map<string, number>()
    const connected = member('peer', 'connected', 1_000)
    updateConnectionProblemSince(
      problemSince,
      [{ member: connected, connectionState: 'connected' }],
      40_000,
    )
    updateConnectionProblemSince(
      problemSince,
      [{ member: connected, connectionState: 'disconnected' }],
      50_000,
    )

    expect(problemSince.get('peer')).toBe(50_000)
    expect(hasLongConnectionProblem(problemSince, 64_999, 15_000)).toBe(false)
    expect(hasLongConnectionProblem(problemSince, 65_000, 15_000)).toBe(true)
  })

  it('clears timers after recovery or room departure', () => {
    const problemSince = new Map([['peer', 1_000]])
    updateConnectionProblemSince(
      problemSince,
      [{ member: member('peer', 'connected', 1_000), connectionState: 'connected' }],
      40_000,
    )
    expect(problemSince.size).toBe(0)

    problemSince.set('peer', 1_000)
    updateConnectionProblemSince(problemSince, [], 40_000)
    expect(problemSince.size).toBe(0)
  })

  it('recommends only when the network is difficult and Together is inactive', () => {
    expect(
      shouldRecommendTogether({
        problematicNat: false,
        isMaster: true,
        longConnectionProblem: true,
        trialStatus: 'available',
      }),
    ).toBe(true)
    expect(
      shouldRecommendTogether({
        problematicNat: false,
        isMaster: false,
        longConnectionProblem: true,
        trialStatus: 'available',
      }),
    ).toBe(false)
    expect(
      shouldRecommendTogether({
        problematicNat: true,
        isMaster: true,
        longConnectionProblem: true,
        trialStatus: 'active',
      }),
    ).toBe(false)
    expect(
      shouldRecommendTogether({
        problematicNat: true,
        isMaster: true,
        longConnectionProblem: true,
        trialStatus: 'expired',
        subscriptionStatus: 'active',
      }),
    ).toBe(false)
  })

  it('offers Try once, then Buy after the trial is no longer available', () => {
    expect(getTogetherRecommendationAction('available')).toBe('try')
    expect(getTogetherRecommendationAction('expired')).toBe('buy')
    expect(getTogetherRecommendationAction('unavailable')).toBe('buy')
  })

  it('accepts only HTTPS checkout URLs on the Waffo checkout hosts', () => {
    expect(isWaffoCheckoutUrl('https://checkout.waffo.ai/order/1')).toBe(true)
    expect(isWaffoCheckoutUrl('https://pancake.waffo.ai/order/1')).toBe(true)
    expect(isWaffoCheckoutUrl('http://checkout.waffo.ai/order/1')).toBe(false)
    expect(isWaffoCheckoutUrl('https://checkout.waffo.ai.example.com/order/1')).toBe(false)
    expect(isWaffoCheckoutUrl('not-a-url')).toBe(false)
  })
})