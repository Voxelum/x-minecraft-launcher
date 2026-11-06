import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  handleMultiplayerRoute,
  iceServers,
  MultiplayerRoom,
  RoomCore,
  sanitizeDisplayName,
  signTicket,
  verifyTicket,
} from './multiplayer.js'

type Sent = { peerId: string; message: any }

function room(maxPeers = 4, now = 1_000) {
  const sent: Sent[] = []
  const closed: Array<{ peerId: string; code: number }> = []
  const persisted: any[] = []
  const core = RoomCore.create('ROOM234', { accountId: 'host', maxPeers }, now, {
    send: (peerId: string, message: any) => sent.push({ peerId, message }),
    close: (peerId: string, code: number) => closed.push({ peerId, code }),
    persist: (meta: any) => persisted.push(structuredClone(meta)),
  })
  const join = (accountId: string, at = now) => {
    const seat = core.admit(accountId, accountId, at)
    core.attach(seat.peerId, accountId, at)
    return seat.peerId
  }
  const last = (peerId: string) => [...sent].reverse().find((s) => s.peerId === peerId && s.message.type === 'room-state')?.message
  const to = (peerId: string, type: string) => sent.filter((s) => s.peerId === peerId && s.message.type === type).map((s) => s.message)
  return { core, sent, closed, persisted, join, last, to }
}

const signal = (receiver?: string, extra: object = {}) => JSON.stringify({
  type: 'signal',
  ...(receiver ? { receiver } : {}),
  payload: { sdp: 'v=0', sdpType: 'offer', session: 's1', candidates: [{ candidate: 'c', mid: '0' }], ...extra },
})

describe('tickets', () => {
  it('verify only when signed with the secret and unexpired', async () => {
    const ticket = await signTicket('secret', { r: 'ROOM234', p: 'p', a: 'a', e: 2_000 })
    expect(await verifyTicket('secret', ticket, 1_000)).toMatchObject({ r: 'ROOM234', p: 'p' })
    expect(await verifyTicket('other', ticket, 1_000)).toBeUndefined()
    expect(await verifyTicket('secret', ticket, 2_000)).toBeUndefined()
    expect(await verifyTicket('secret', `${ticket}x`, 1_000)).toBeUndefined()
    expect(await verifyTicket('secret', 'garbage', 1_000)).toBeUndefined()
    expect(await verifyTicket('secret', undefined, 1_000)).toBeUndefined()
  })

  it('cleans display names', () => {
    expect(sanitizeDisplayName('  A\u0000B  ')).toBe('AB')
    expect(sanitizeDisplayName(42)).toBe('Player')
    expect(sanitizeDisplayName('x'.repeat(100))).toHaveLength(32)
  })
})

describe('room membership', () => {
  it('makes the creator master and lists members in join order', () => {
    const { core, join, last } = room()
    const host = join('host')
    const guest = join('guest', 1_100)
    const state = last(guest)
    expect(state).toMatchObject({ selfPeerId: guest, masterPeerId: host, status: 'open', maxPeers: 4 })
    expect(state.members.map((m: any) => m.accountId)).toEqual(['host', 'guest'])
    expect(state.members[1].status).toBe('negotiating')
    expect(core.revision).toBe(2)
  })

  it('refuses a full room but lets a member reconnect into its own seat', () => {
    const { core, join } = room(2)
    join('host')
    join('a')
    expect(() => core.admit('b', 'b', 1_000)).toThrow('room_full')
    expect(() => core.admit('a', 'a', 1_000)).not.toThrow()
  })

  it('counts unclaimed seats until their tickets expire', () => {
    const { core } = room(2)
    core.admit('host', 'host', 1_000)
    core.admit('a', 'a', 1_000)
    expect(() => core.admit('b', 'b', 1_001)).toThrow('room_full')
    expect(() => core.admit('b', 'b', 1_000 + 61_000)).not.toThrow()
  })

  it('consumes a seat once and rejects another account', () => {
    const { core } = room()
    const seat = core.admit('a', 'a', 1_000)
    expect(() => core.attach(seat.peerId, 'b', 1_000)).toThrow('invalid_ticket')
    core.attach(seat.peerId, 'a', 1_000)
    expect(() => core.attach(seat.peerId, 'a', 1_000)).toThrow('invalid_ticket')
    const late = core.admit('c', 'c', 1_000)
    expect(() => core.attach(late.peerId, 'c', 1_000 + 61_000)).toThrow('invalid_ticket')
  })

  it('replaces an older connection for the same account and keeps the host in charge', () => {
    const { core, join, closed, last } = room()
    const first = join('host')
    const guest = join('guest')
    const second = join('host', 1_200)
    expect(closed).toContainEqual({ peerId: first, code: 4001 })
    expect(last(guest).masterPeerId).toBe(second)
    expect(core.status).toBe('open')
    core.detach(first, 1_300)
    expect(core.status).toBe('open')
  })

  it('waits for the host after a drop and resumes when the host returns', () => {
    const { core, join, last } = room()
    const host = join('host')
    const guest = join('guest')
    core.detach(host, 5_000)
    expect(last(guest)).toMatchObject({ status: 'waiting-master', masterPeerId: '' })
    const back = join('host', 6_000)
    expect(last(guest)).toMatchObject({ status: 'open', masterPeerId: back })
  })

  it('closes after the grace period without a host and then deletes the record', () => {
    const { core, join, closed, last } = room()
    const host = join('host')
    const guest = join('guest')
    core.detach(host, 5_000)
    expect(core.tick(5_000 + 59_000)).toBe(false)
    expect(core.closed).toBe(false)
    core.tick(5_000 + 60_000)
    expect(core.closed).toBe(true)
    expect(last(guest).status).toBe('closed')
    expect(closed).toContainEqual({ peerId: guest, code: 4000 })
    expect(() => core.admit('late', 'late', 70_000)).toThrow('room_not_found')
    expect(core.tick(65_000 + 3_600_000)).toBe(true)
  })

  it('closes a room nobody ever joined', () => {
    const { core } = room()
    core.tick(1_000 + 60_000)
    expect(core.closed).toBe(true)
  })

  it('expires after its maximum lifetime', () => {
    const { core, join } = room()
    join('host')
    core.tick(1_000 + 24 * 3_600_000)
    expect(core.closed).toBe(true)
  })

  it('reports the nearest deadline', () => {
    const { core, join } = room()
    expect(core.nextDeadline()).toBe(1_000 + 60_000)
    join('host')
    expect(core.nextDeadline()).toBe(1_000 + 24 * 3_600_000)
  })
})

describe('room messages', () => {
  it('relays signals between host and member with a trusted sender', () => {
    const { core, join, to } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(host, signal(guest), 2_000)
    expect(to(guest, 'signal')).toEqual([{
      type: 'signal',
      sender: host,
      payload: { sdp: 'v=0', sdpType: 'offer', session: 's1', candidates: [{ candidate: 'c', mid: '0' }] },
    }])
    core.message(guest, signal(), 2_000)
    expect(to(host, 'signal')[0].sender).toBe(guest)
  })

  it('does not let members signal each other or pick a receiver', () => {
    const { core, join, to } = room()
    const host = join('host')
    const a = join('a')
    const b = join('b')
    core.message(a, signal(b), 2_000)
    expect(to(b, 'signal')).toHaveLength(0)
    expect(to(host, 'signal')).toHaveLength(1)
    core.message(host, signal('missing'), 2_000)
    expect(to(host, 'error').map((e) => e.code)).toEqual(['invalid_receiver'])
  })

  it('rejects malformed, oversized and unsafe payloads', () => {
    const { core, join, to, closed } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(host, '{', 2_000)
    core.message(host, signal(guest, { sdpType: 'pranswer' }), 2_000)
    core.message(host, signal(guest, { sharedTurnServer: { urls: 'http://evil', username: 'u', credential: 'c' } }), 2_000)
    core.message(host, signal(guest, { candidates: Array.from({ length: 65 }, () => ({ candidate: 'c', mid: '0' })) }), 2_000)
    core.message(host, JSON.stringify({ type: 'nope' }), 2_000)
    expect(to(host, 'error').map((e) => e.code)).toEqual(Array(5).fill('invalid_message'))
    expect(to(guest, 'signal')).toHaveLength(0)
    core.message(host, 'x'.repeat(70_000), 2_000)
    expect(closed).toContainEqual({ peerId: host, code: 1008 })
  })

  it('passes a valid shared TURN server and drops extra fields', () => {
    const { core, join, to } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(host, signal(guest, { sharedTurnServer: { urls: ['turn:t.example:3478'], username: 'u', credential: 'c', extra: 1 } }), 2_000)
    expect(to(guest, 'signal')[0].payload.sharedTurnServer).toEqual({ urls: ['turn:t.example:3478'], username: 'u', credential: 'c' })
  })

  it('drops a peer that floods the room', () => {
    const { core, join, closed } = room()
    const host = join('host')
    join('guest')
    for (let i = 0; i < 100; i++) core.message(host, JSON.stringify({ type: 'nope' }), 2_000)
    expect(closed.some((c) => c.peerId === host && c.code === 1008)).toBe(true)
  })

  it('lets a member report connection state, but not the host', () => {
    const { core, join, last } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(guest, JSON.stringify({ type: 'rtc-state', state: 'connected' }), 2_000)
    expect(last(host).members.find((m: any) => m.peerId === guest).status).toBe('connected')
    const before = core.revision
    core.message(guest, JSON.stringify({ type: 'rtc-state', state: 'connected' }), 2_000)
    expect(core.revision).toBe(before)
    core.message(host, JSON.stringify({ type: 'rtc-state', state: 'negotiating' }), 2_000)
    expect(last(host).members[0].status).toBe('connected')
  })

  it('lets only the host remove a member and blocks their return', () => {
    const { core, join, closed, last, to } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(guest, JSON.stringify({ type: 'remove-member', peerId: host }), 2_000)
    expect(to(guest, 'error').map((e) => e.code)).toEqual(['forbidden'])
    core.message(host, JSON.stringify({ type: 'remove-member', peerId: guest }), 2_000)
    expect(closed).toContainEqual({ peerId: guest, code: 4003 })
    expect(last(host).members).toHaveLength(1)
    expect(() => core.admit('guest', 'guest', 2_000)).toThrow('removed_from_room')
  })

  it('transfers the host role only to a connected member', () => {
    const { core, join, last, persisted } = room()
    const host = join('host')
    const guest = join('guest')
    core.message(host, JSON.stringify({ type: 'transfer-master', peerId: guest }), 2_000)
    expect(last(host).masterPeerId).toBe(host)
    core.message(guest, JSON.stringify({ type: 'rtc-state', state: 'connected' }), 2_000)
    core.message(host, JSON.stringify({ type: 'transfer-master', peerId: guest }), 2_000)
    expect(last(host).masterPeerId).toBe(guest)
    expect(persisted.at(-1).masterAccountId).toBe('guest')
    core.detach(host, 3_000)
    expect(core.status).toBe('open')
    const seat = core.admit('guest', 'guest', 4_000)
    expect(seat.role).toBe('master')
    expect(core.admit('host', 'host', 4_000).role).toBe('member')
  })

  it('closes the room for everyone when the host closes it', () => {
    const { core, join, last } = room()
    join('host')
    const guest = join('guest')
    core.closeRoom(3_000)
    expect(last(guest).status).toBe('closed')
    expect(core.members.size).toBe(0)
  })
})

function fakeStorage() {
  const data = new Map<string, unknown>()
  let alarm: number | undefined
  return {
    data,
    get alarm() { return alarm },
    api: {
      get: async (k: string) => data.get(k),
      put: async (k: string, v: unknown) => { data.set(k, structuredClone(v)) },
      deleteAll: async () => { data.clear(); alarm = undefined },
      setAlarm: async (t: number) => { alarm = t },
    },
  }
}

function namespace() {
  const rooms = new Map<string, MultiplayerRoom>()
  const env: any = {
    DB: {},
    ROOM_TICKET_SECRET: 'secret',
    MULTIPLAYER_ROOMS: {
      idFromName: (name: string) => name,
      get: (name: string) => {
        if (!rooms.has(name)) rooms.set(name, new MultiplayerRoom({ storage: fakeStorage().api } as any, env))
        const room = rooms.get(name)!
        return { fetch: (request: Request) => room.fetch(request) }
      },
    },
  }
  return env
}

const call = (env: any, method: string, path: string, account: string | undefined, body?: unknown) => {
  const request = new Request(`https://api.example.com${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const authenticate = async () => {
    if (!account) throw Object.assign(new Error('unauthorized'), { status: 401, code: 'unauthorized' })
    return { accountId: account, sessionId: 's' }
  }
  return handleMultiplayerRoute(request, env, path, authenticate, 1_000)
}

describe('room routes', () => {
  it('ignores other paths', async () => {
    expect(await call(namespace(), 'GET', '/v1/status', 'a')).toBeUndefined()
  })

  it('requires configuration and sign-in', async () => {
    expect((await call({}, 'POST', '/v1/multiplayer/rooms', 'a', {}))!.status).toBe(503)
    expect((await call({ ...namespace(), ROOM_TICKET_SECRET: '' }, 'POST', '/v1/rtc/official', 'a'))!.status).toBe(503)
    expect((await call(namespace(), 'POST', '/v1/multiplayer/rooms', undefined, {}))!.status).toBe(401)
    expect((await call(namespace(), 'POST', '/v1/rtc/official', undefined))!.status).toBe(401)
  })

  it('creates a room with an admission the launcher accepts', async () => {
    const env = namespace()
    const response = (await call(env, 'POST', '/v1/multiplayer/rooms', 'host', { displayName: 'Host', maxPeers: 8 }))!
    expect(response.status).toBe(200)
    const admission = await response.json()
    expect(admission).toMatchObject({ role: 'master', maxPeers: 8 })
    expect(admission.roomId).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
    expect(admission.socketUrl).toBe(`https://api.example.com/v1/multiplayer/rooms/${admission.roomId}/socket`)
    expect(admission.roomSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(admission.expiresAt)).toBeGreaterThan(1_000)
    expect(await verifyTicket('secret', admission.ticket, 1_000)).toMatchObject({ r: admission.roomId, p: admission.peerId, a: 'host' })
  })

  it('clamps room size', async () => {
    const env = namespace()
    const huge = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'a', { maxPeers: 500 }))!.json()
    const tiny = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'a', { maxPeers: 1 }))!.json()
    expect([huge.maxPeers, tiny.maxPeers]).toEqual([16, 2])
  })

  it('joins an existing room as a member and refuses unknown or invalid rooms', async () => {
    const env = namespace()
    const { roomId } = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'host', {}))!.json()
    const joined = await (await call(env, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, 'guest', { displayName: 'G' }))!.json()
    expect(joined).toMatchObject({ roomId, role: 'member' })
    expect((await call(env, 'POST', '/v1/multiplayer/rooms/UNKNOWN2/join', 'guest', { createIfMissing: false }))!.status).toBe(404)
    expect((await call(env, 'POST', '/v1/multiplayer/rooms/a%2Fb/join', 'guest', {}))!.status).toBe(404)
    expect((await call(env, 'POST', '/v1/multiplayer/rooms/short/join', 'guest', {}))!.status).toBe(404)
  })

  it('creates a missing room on join when asked and makes the joiner host', async () => {
    const env = namespace()
    const made = await (await call(env, 'POST', '/v1/multiplayer/rooms/MYROOM42/join', 'a', { createIfMissing: true }))!.json()
    expect(made).toMatchObject({ roomId: 'MYROOM42', role: 'master' })
    const again = await (await call(env, 'POST', '/v1/multiplayer/rooms/MYROOM42/join', 'b', { createIfMissing: true }))!.json()
    expect(again.role).toBe('member')
  })

  it('reports a full room', async () => {
    const env = namespace()
    const { roomId } = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'host', { maxPeers: 2 }))!.json()
    await call(env, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, 'a', {})
    const response = (await call(env, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, 'b', {}))!
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'room_full', message: 'room_full' })
  })

  it('lets only the host delete a room', async () => {
    const env = namespace()
    const { roomId } = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'host', {}))!.json()
    expect((await call(env, 'DELETE', `/v1/multiplayer/rooms/${roomId}`, 'guest'))!.status).toBe(403)
    expect((await call(env, 'DELETE', `/v1/multiplayer/rooms/${roomId}`, 'host'))!.status).toBe(204)
    expect((await call(env, 'DELETE', `/v1/multiplayer/rooms/${roomId}`, 'host'))!.status).toBe(404)
    expect((await call(env, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, 'guest', {}))!.status).toBe(404)
  })

  it('rejects wrong methods and bodies', async () => {
    const env = namespace()
    expect((await call(env, 'GET', '/v1/multiplayer/rooms', 'a'))!.status).toBe(405)
    expect((await call(env, 'GET', '/v1/rtc/official', 'a'))!.status).toBe(405)
    const bad = handleMultiplayerRoute(new Request('https://api.example.com/v1/multiplayer/rooms', { method: 'POST', body: '[]' }), env, '/v1/multiplayer/rooms', async () => ({ accountId: 'a' }), 1_000)
    expect((await bad)!.status).toBe(400)
  })

  it('rate limits per account', async () => {
    const env = { ...namespace(), MULTIPLAYER_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) } }
    const response = (await call(env, 'POST', '/v1/multiplayer/rooms', 'a', {}))!
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(env.MULTIPLAYER_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'a' })
  })

  it('refuses a socket without an upgrade or a valid ticket', async () => {
    const env = namespace()
    const { roomId } = await (await call(env, 'POST', '/v1/multiplayer/rooms', 'host', {}))!.json()
    const plain = (await call(env, 'GET', `/v1/multiplayer/rooms/${roomId}/socket`, undefined))!
    expect(plain.status).toBe(426)
    const upgrade = new Request(`https://api.example.com/v1/multiplayer/rooms/${roomId}/socket?ticket=bad`, { headers: { upgrade: 'websocket' } })
    const response = (await handleMultiplayerRoute(upgrade, env, `/v1/multiplayer/rooms/${roomId}/socket`, async () => { throw new Error('no auth on socket') }, 1_000))!
    expect(response.status).toBe(401)
  })
})

describe('ICE servers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers STUN only when no relay is configured', async () => {
    expect(await iceServers({})).toEqual({ stuns: ['stun:stun.cloudflare.com:3478'], ttl: 3600, servers: [] })
    expect((await iceServers({ STUN_URLS: 'stun:a:1, stun:b:2' })).stuns).toEqual(['stun:a:1', 'stun:b:2'])
  })

  it('adds Cloudflare TURN credentials and discards non-relay entries', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443'], username: 'u', credential: 'c' },
        { urls: 'https://evil', username: 'u', credential: 'c' },
      ],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const result = await iceServers({ TURN_KEY_ID: 'key', TURN_API_TOKEN: 'token' })
    expect(result.servers).toEqual([{ urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443'], username: 'u', credential: 'c' }])
    expect(result.turnSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key/credentials/generate-ice-servers',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer token' }) }),
    )
  })

  it('fails as unavailable when the relay provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })))
    await expect(iceServers({ TURN_KEY_ID: 'k', TURN_API_TOKEN: 't' })).rejects.toMatchObject({ status: 503, code: 'relay_unavailable' })
    const env = { ...namespace(), TURN_KEY_ID: 'k', TURN_API_TOKEN: 't' }
    expect((await call(env, 'POST', '/v1/rtc/official', 'a'))!.status).toBe(503)
  })
})

describe('room sockets', () => {
  class FakeSocket {
    listeners = new Map<string, Array<(event: any) => void>>()
    received: any[] = []
    closedWith?: { code: number; reason: string }
    accept() {}
    addEventListener(type: string, listener: (event: any) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    send(data: string) { this.received.push(JSON.parse(data)) }
    close(code: number, reason: string) {
      this.closedWith = { code, reason }
      this.emit('close', {})
    }
    emit(type: string, event: unknown) { this.listeners.get(type)?.forEach((l) => l(event)) }
  }
  const pairs: Array<{ client: object; server: FakeSocket }> = []
  const NativeResponse = Response

  function install() {
    vi.stubGlobal('WebSocketPair', class {
      0: object
      1: FakeSocket
      constructor() {
        const server = new FakeSocket()
        const client = {}
        pairs.push({ client, server })
        this[0] = client
        this[1] = server
      }
    })
    // Node refuses status 101; Workers allow it.
    vi.stubGlobal('Response', class extends NativeResponse {
      webSocket?: object
      constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: object }) {
        if (init?.status === 101) {
          super(null, { status: 200 })
          this.webSocket = init.webSocket
          Object.defineProperty(this, 'status', { value: 101 })
        } else super(body, init)
      }
    })
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    pairs.length = 0
  })

  async function open(env: any, roomId: string, ticket: string) {
    const request = new Request(`https://api.example.com/v1/multiplayer/rooms/${roomId}/socket?ticket=${encodeURIComponent(ticket)}`, {
      headers: { upgrade: 'websocket' },
    })
    const response = (await handleMultiplayerRoute(request, env, `/v1/multiplayer/rooms/${roomId}/socket`, async () => { throw new Error('no auth') }, Date.now()))!
    return { response, server: pairs.at(-1)?.server as FakeSocket }
  }

  it('relays signaling between a host and guest over their sockets and rejects ticket reuse', async () => {
    install()
    const env = namespace()
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const create = (path: string, account: string, body: object) =>
      handleMultiplayerRoute(new Request(`https://api.example.com${path}`, { method: 'POST', body: JSON.stringify(body) }), env, path, async () => ({ accountId: account }), now).then((r) => r!.json())
    const host = await create('/v1/multiplayer/rooms', 'host', { displayName: 'Host' })
    const hostSocket = await open(env, host.roomId, host.ticket)
    expect(hostSocket.response.status).toBe(101)
    expect(hostSocket.server.received.at(-1)).toMatchObject({ type: 'room-state', selfPeerId: host.peerId, masterPeerId: host.peerId, status: 'open' })

    const guest = await create(`/v1/multiplayer/rooms/${host.roomId}/join`, 'guest', { displayName: 'Guest' })
    const guestSocket = await open(env, host.roomId, guest.ticket)
    expect(hostSocket.server.received.at(-1).members.map((m: any) => m.displayName)).toEqual(['Host', 'Guest'])

    hostSocket.server.emit('message', { data: signal(guest.peerId) })
    expect(guestSocket.server.received.at(-1)).toMatchObject({ type: 'signal', sender: host.peerId })

    const replay = await open(env, host.roomId, guest.ticket)
    expect(replay.server.closedWith?.code).toBe(4003)

    // The rejected replay must not take over delivery for the live guest socket.
    const before = guestSocket.server.received.length
    hostSocket.server.emit('message', { data: signal(guest.peerId) })
    expect(guestSocket.server.received).toHaveLength(before + 1)

    guestSocket.server.emit('close', {})
    expect(hostSocket.server.received.at(-1).members).toHaveLength(1)

    hostSocket.server.emit('message', { data: 'x'.repeat(70_000) })
    expect(hostSocket.server.closedWith?.code).toBe(1008)
  })

  it('refuses sockets for other rooms, forged tickets and missing rooms', async () => {
    install()
    const env = namespace()
    const now = Date.now()
    const made = await (await handleMultiplayerRoute(new Request('https://api.example.com/v1/multiplayer/rooms', { method: 'POST', body: '{}' }), env, '/v1/multiplayer/rooms', async () => ({ accountId: 'host' }), now))!.json()
    expect((await open(env, 'OTHERROOM', made.ticket)).response.status).toBe(401)
    expect((await open(env, made.roomId, `${made.ticket.slice(0, -2)}xx`)).response.status).toBe(401)
    const forged = await signTicket('secret', { r: 'NOROOM22', p: 'p', a: 'a', e: now + 60_000 })
    expect((await open(env, 'NOROOM22', forged)).response.status).toBe(404)
  })
})
