import { describe, expect, it } from 'vitest'
import {
  findInstanceManifestMatch,
  getInstanceMatchCandidates,
  getPeerInstanceUpdateCandidate,
  getTogetherRecommendationAction,
  getVisibleRoomPeerMembers,
  hasLongConnectionProblem,
  isInstanceManifestMatched,
  isProblematicNatType,
  isRuntimeMatched,
  isWaffoCheckoutUrl,
  mergeRoomPeerConnections,
  resolveLanSharingInstance,
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

  it('shows members connected to the master topology only', () => {
    const self = member('self', 'connected', 1_000)
    const master = member('master', 'connected', 2_000)
    const other = member('other', 'connected', 3_000)

    expect(getVisibleRoomPeerMembers([self, master, other], 'self', 'master')).toEqual([master])
    expect(getVisibleRoomPeerMembers([self, master, other], 'master', 'master')).toEqual([self, other])
  })

  it('matches all runtime layers before reusing an instance', () => {
    expect(isRuntimeMatched(
      { minecraft: '1.21.1', fabricLoader: '0.16.10' },
      { minecraft: '1.21.1', fabricLoader: '0.16.10' },
    )).toBe(true)
    expect(isRuntimeMatched(
      { minecraft: '1.21.1', fabricLoader: '0.16.9' },
      { minecraft: '1.21.1', fabricLoader: '0.16.10' },
    )).toBe(false)
  })

  it('matches instance runtime and mods with or without a transmitted fingerprint', () => {
    const manifest = (sha1: string, fingerprint?: string) => ({
      runtime: { minecraft: '1.21.1', fabricLoader: '0.16.10' },
      files: [{ path: 'mods/example.jar', hashes: { sha1 } }],
      fingerprint,
    } as any)

    expect(isInstanceManifestMatched(manifest('same'), manifest('same'))).toBe(true)
    expect(isInstanceManifestMatched(manifest('same', 'fingerprint'), manifest('same', 'fingerprint'))).toBe(true)
    expect(isInstanceManifestMatched(manifest('same', 'local'), manifest('same', 'remote'))).toBe(false)
    expect(isInstanceManifestMatched(manifest('local'), manifest('remote'))).toBe(false)
    expect(isInstanceManifestMatched(
      manifest('same'),
      { ...manifest('same'), runtime: { minecraft: '1.21.1', fabricLoader: '0.16.9' } },
    )).toBe(false)
  })

  it('prioritizes matching peer provenance without skipping other runtime candidates', () => {
    const instance = (
      path: string,
      upstream?: { type: string; id?: string; accountId?: string; fingerprint?: string },
    ) => ({
      path,
      runtime: { minecraft: '1.21.1', fabricLoader: '0.16.10' },
      upstream,
    })
    const candidates = [
      instance('ordinary'),
      instance('same-account', { type: 'peer', id: 'legacy', accountId: 'account-a' }),
      instance('same-fingerprint', { type: 'peer', id: 'account-b', fingerprint: 'pack-a' }),
      { ...instance('wrong-runtime'), runtime: { minecraft: '1.20.1' } },
      { ...instance('bedrock'), edition: 'bedrock' },
    ]

    expect(getInstanceMatchCandidates(
      candidates,
      { runtime: { minecraft: '1.21.1', fabricLoader: '0.16.10' }, fingerprint: 'pack-a' },
      'account-a',
    ).map(({ path }) => path)).toEqual(['same-fingerprint', 'same-account', 'ordinary'])
    expect(getInstanceMatchCandidates(
      candidates,
      { runtime: { minecraft: '1.21.1', fabricLoader: '0.16.10' } },
    ).map(({ path }) => path)).toEqual(['ordinary', 'same-account', 'same-fingerprint'])
  })

  it('validates account indicators and falls back to another exact content match', async () => {
    const remote = {
      runtime: { minecraft: '1.21.1', forge: '', neoForged: '', fabricLoader: '', quiltLoader: '', optifine: '', labyMod: '' },
      files: [{ path: 'mods/example.jar', hashes: { sha1: 'remote' } }],
      fingerprint: 'remote-fingerprint',
    } as any
    const candidates = [
      {
        path: 'ordinary-exact',
        runtime: remote.runtime,
      },
      {
        path: 'same-account-but-modified',
        runtime: remote.runtime,
        upstream: { type: 'peer', id: 'account-a', accountId: 'account-a' },
      },
    ]
    const checked: string[] = []

    const matched = await findInstanceManifestMatch(
      candidates,
      remote,
      'account-a',
      async (candidate) => {
        checked.push(candidate.path)
        return candidate.path === 'ordinary-exact'
          ? remote
          : { ...remote, fingerprint: 'locally-modified' }
      },
    )

    expect(checked).toEqual(['same-account-but-modified', 'ordinary-exact'])
    expect(matched?.path).toBe('ordinary-exact')
  })

  it('selects only an unambiguous peer instance for a confirmed manifest update', () => {
    const manifest = {
      runtime: { minecraft: '1.21.1', fabricLoader: '0.16.10' },
      fingerprint: 'pack-a',
    }
    const instance = (
      path: string,
      upstream: { type: string; id?: string; accountId?: string; fingerprint?: string },
    ) => ({ path, runtime: manifest.runtime, upstream })

    expect(getPeerInstanceUpdateCandidate([
      instance('same-account', { type: 'peer', id: 'account-a', accountId: 'account-a' }),
      instance('same-pack', { type: 'peer', id: 'account-b', fingerprint: 'pack-a' }),
    ], manifest, 'account-a')?.path).toBe('same-pack')
    expect(getPeerInstanceUpdateCandidate([
      instance('only-account-instance', { type: 'peer', id: 'legacy', accountId: 'account-a' }),
      instance('ordinary', { type: 'modrinth-modpack', id: 'project' }),
    ], { ...manifest, fingerprint: undefined }, 'account-a')?.path).toBe('only-account-instance')
    expect(getPeerInstanceUpdateCandidate([
      instance('ambiguous-a', { type: 'peer', id: 'account-a', accountId: 'account-a' }),
      instance('ambiguous-b', { type: 'peer', id: 'account-a', accountId: 'account-a' }),
    ], { ...manifest, fingerprint: undefined }, 'account-a')).toBeUndefined()
    expect(getPeerInstanceUpdateCandidate([
      instance('duplicate-fingerprint-a', { type: 'peer', id: 'account-a', fingerprint: 'pack-a' }),
      instance('duplicate-fingerprint-b', { type: 'peer', id: 'account-a', fingerprint: 'pack-a' }),
    ], manifest, 'account-a')).toBeUndefined()
  })

  it('resolves the instance opening LAN without guessing across multiple games', () => {
    const client = (gameDirectory: string) => ({ side: 'client' as const, options: { gameDirectory } })
    const server = (gameDirectory: string) => ({ side: 'server' as const, options: { gameDirectory } })

    expect(resolveLanSharingInstance([client('instance-a'), server('server-a')], '')).toBe('instance-a')
    expect(resolveLanSharingInstance([client('instance-a'), client('instance-b')], 'instance-b')).toBe('instance-b')
    expect(resolveLanSharingInstance([client('instance-a'), client('instance-b')], 'instance-c')).toBeUndefined()
    expect(resolveLanSharingInstance([server('server-a')], 'server-a')).toBeUndefined()
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