// Vardrynn multiplayer (phase 7): room admission, signaling and ICE credentials.
// Rooms are Cloudflare Durable Objects (`env.MULTIPLAYER_ROOMS`, class `MultiplayerRoom`). The Worker
// authenticates the account, then the room object admits the peer and relays signaling over a WebSocket.
// Media never passes through here; peers connect directly or through the TURN relay below.
export const MIN_PEERS = 2
export const MAX_PEERS = 16
const DEFAULT_PEERS = 8
const MAX_MESSAGE_BYTES = 64 * 1024
const MAX_SDP = 32 * 1024
const MAX_CANDIDATES = 64
const TICKET_TTL_MS = 60_000
const MASTER_GRACE_MS = 60_000
const ROOM_LIFETIME_MS = 24 * 3_600_000
const CLOSED_RETENTION_MS = 3_600_000
const BUCKET_BURST = 60
const BUCKET_PER_SECOND = 20
const ROOM_ID = /^[A-Za-z0-9_-]{6,64}$/
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
const fail = (status, error) => Object.assign(new Error(error), { status, code: error })

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const encoder = new TextEncoder()

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Tickets bind one admission (room, peer, account) for a minute; the room object consumes each once. */
export async function signTicket(secret, claims) {
  const body = b64url(encoder.encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${b64url(signature)}`
}

export async function verifyTicket(secret, ticket, now) {
  const [body, signature, extra] = String(ticket ?? '').split('.')
  if (!body || !signature || extra !== undefined) return undefined
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(signature), encoder.encode(body))
    if (!valid) return undefined
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body)))
    if (typeof claims.e !== 'number' || claims.e <= now) return undefined
    return claims
  } catch {
    return undefined
  }
}

export function sanitizeDisplayName(value) {
  const printable = typeof value === 'string'
    ? Array.from(value).filter((c) => c.charCodeAt(0) > 0x1f && c.charCodeAt(0) !== 0x7f).join('')
    : ''
  return printable.trim().slice(0, 32) || 'Player'
}

function validTurnServer(value) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'invalid_message')
  const urls = typeof value.urls === 'string' ? [value.urls] : value.urls
  if (
    !Array.isArray(urls) || urls.length === 0 || urls.length > 8 ||
    !urls.every((url) => typeof url === 'string' && url.length <= 256 && /^turns?:/.test(url)) ||
    typeof value.username !== 'string' || value.username.length > 256 ||
    typeof value.credential !== 'string' || value.credential.length > 256
  ) throw fail(400, 'invalid_message')
  return { urls, username: value.username, credential: value.credential }
}

function validSignal(message) {
  const payload = message.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw fail(400, 'invalid_message')
  if (
    typeof payload.sdp !== 'string' || payload.sdp.length > MAX_SDP ||
    (payload.sdpType !== 'offer' && payload.sdpType !== 'answer') ||
    typeof payload.session !== 'string' || payload.session.length > 128 ||
    !Array.isArray(payload.candidates) || payload.candidates.length > MAX_CANDIDATES
  ) throw fail(400, 'invalid_message')
  const candidates = payload.candidates.map((c) => {
    if (!c || typeof c.candidate !== 'string' || c.candidate.length > 512 || typeof c.mid !== 'string' || c.mid.length > 64) {
      throw fail(400, 'invalid_message')
    }
    return { candidate: c.candidate, mid: c.mid }
  })
  const sharedTurnServer = validTurnServer(payload.sharedTurnServer)
  return {
    sdp: payload.sdp,
    sdpType: payload.sdpType,
    session: payload.session,
    candidates,
    ...(sharedTurnServer ? { sharedTurnServer } : {}),
  }
}

/**
 * Room state and rules, independent of the Workers runtime so it can be tested directly.
 * `hooks.send(peerId, message)` and `hooks.close(peerId, code, reason)` talk to sockets;
 * `hooks.persist(meta)` is called whenever the durable part of the room changes.
 */
export class RoomCore {
  constructor(roomId, meta, hooks) {
    this.roomId = roomId
    this.meta = meta
    this.hooks = hooks
    this.members = new Map()
    this.pending = new Map()
    this.buckets = new Map()
    this.masterPeerId = ''
    this.masterLostAt = meta.createdAt
    this.revision = 0
  }

  static create(roomId, { accountId, maxPeers }, now, hooks) {
    const meta = {
      sessionId: crypto.randomUUID(),
      masterAccountId: accountId,
      maxPeers: Number.isSafeInteger(maxPeers) ? Math.min(MAX_PEERS, Math.max(MIN_PEERS, maxPeers)) : DEFAULT_PEERS,
      createdAt: now,
      closedAt: 0,
      kicked: [],
    }
    hooks.persist(meta)
    return new RoomCore(roomId, meta, hooks)
  }

  get closed() {
    return this.meta.closedAt > 0
  }

  get status() {
    if (this.closed) return 'closed'
    return this.masterPeerId && this.members.has(this.masterPeerId) ? 'open' : 'waiting-master'
  }

  occupied(excludeAccountId, now) {
    this.prunePending(now)
    let count = 0
    for (const m of this.members.values()) if (m.accountId !== excludeAccountId) count++
    for (const p of this.pending.values()) if (p.accountId !== excludeAccountId) count++
    return count
  }

  prunePending(now) {
    for (const [peerId, p] of this.pending) if (p.expiresAt <= now) this.pending.delete(peerId)
  }

  /** Reserves a seat. The caller turns the result into a signed ticket. */
  admit(accountId, displayName, now) {
    if (this.closed) throw fail(404, 'room_not_found')
    if (this.meta.kicked.includes(accountId)) throw fail(403, 'removed_from_room')
    if (this.occupied(accountId, now) >= this.meta.maxPeers) throw fail(403, 'room_full')
    for (const [peerId, p] of this.pending) if (p.accountId === accountId) this.pending.delete(peerId)
    const peerId = crypto.randomUUID()
    const role = accountId === this.meta.masterAccountId ? 'master' : 'member'
    this.pending.set(peerId, { accountId, displayName: sanitizeDisplayName(displayName), expiresAt: now + TICKET_TTL_MS })
    return { peerId, role, maxPeers: this.meta.maxPeers, roomSessionId: this.meta.sessionId, expiresAt: now + TICKET_TTL_MS }
  }

  /** Turns a reserved seat into a member once its socket is open. */
  attach(peerId, accountId, now) {
    this.prunePending(now)
    const seat = this.pending.get(peerId)
    if (this.closed) throw fail(404, 'room_not_found')
    if (!seat || seat.accountId !== accountId) throw fail(401, 'invalid_ticket')
    this.pending.delete(peerId)
    for (const [id, m] of this.members) {
      if (m.accountId === accountId) {
        this.members.delete(id)
        this.buckets.delete(id)
        if (id === this.masterPeerId) this.masterPeerId = ''
        this.hooks.close(id, 4001, 'Replaced by a newer connection')
      }
    }
    const isMaster = accountId === this.meta.masterAccountId
    this.members.set(peerId, {
      peerId,
      accountId,
      displayName: seat.displayName,
      status: isMaster ? 'connected' : 'negotiating',
      joinedAt: now,
    })
    if (isMaster) {
      this.masterPeerId = peerId
      this.masterLostAt = 0
    }
    this.changed()
  }

  detach(peerId, now) {
    if (!this.members.delete(peerId)) return
    this.buckets.delete(peerId)
    if (peerId === this.masterPeerId) {
      this.masterPeerId = ''
      this.masterLostAt = now
    }
    if (!this.closed) this.changed()
  }

  /** Master-only, also reached through the HTTP DELETE route. */
  closeRoom(now) {
    if (this.closed) return
    this.meta.closedAt = now
    this.masterPeerId = ''
    this.hooks.persist(this.meta)
    this.revision++
    this.broadcast()
    for (const id of this.members.keys()) this.hooks.close(id, 4000, 'Room closed')
    this.members.clear()
    this.pending.clear()
    this.buckets.clear()
  }

  changed() {
    this.revision++
    this.broadcast()
  }

  stateFor(peerId) {
    return {
      type: 'room-state',
      selfPeerId: peerId,
      masterPeerId: this.masterPeerId,
      members: [...this.members.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(({ peerId: id, accountId, displayName, status, joinedAt }) => ({ peerId: id, accountId, displayName, status, joinedAt })),
      status: this.status,
      maxPeers: this.meta.maxPeers,
      revision: this.revision,
    }
  }

  broadcast() {
    for (const peerId of this.members.keys()) this.hooks.send(peerId, this.stateFor(peerId))
  }

  allow(peerId, now) {
    const bucket = this.buckets.get(peerId) ?? { tokens: BUCKET_BURST, at: now }
    bucket.tokens = Math.min(BUCKET_BURST, bucket.tokens + ((now - bucket.at) / 1000) * BUCKET_PER_SECOND)
    bucket.at = now
    this.buckets.set(peerId, bucket)
    if (bucket.tokens < 1) return false
    bucket.tokens--
    return true
  }

  message(peerId, raw, now) {
    const member = this.members.get(peerId)
    if (!member || this.closed) return
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES || !this.allow(peerId, now)) {
      this.hooks.close(peerId, 1008, 'Message rejected')
      this.detach(peerId, now)
      return
    }
    try {
      this.handle(member, JSON.parse(raw), now)
    } catch (e) {
      this.hooks.send(peerId, { type: 'error', code: e?.code ?? 'invalid_message' })
    }
  }

  handle(member, message, now) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw fail(400, 'invalid_message')
    const isMaster = member.peerId === this.masterPeerId
    switch (message.type) {
      case 'signal': {
        const payload = validSignal(message)
        const receiverId = isMaster ? message.receiver : this.masterPeerId
        if (typeof receiverId !== 'string' || receiverId === member.peerId || !this.members.has(receiverId)) {
          throw fail(400, 'invalid_receiver')
        }
        this.hooks.send(receiverId, { type: 'signal', sender: member.peerId, payload })
        return
      }
      case 'rtc-state': {
        if (isMaster || (message.state !== 'connected' && message.state !== 'negotiating')) throw fail(400, 'invalid_message')
        if (member.status !== message.state) {
          member.status = message.state
          this.changed()
        }
        return
      }
      case 'remove-member': {
        const target = this.members.get(message.peerId)
        if (!isMaster || !target || target.peerId === member.peerId) throw fail(403, 'forbidden')
        this.meta.kicked.push(target.accountId)
        this.hooks.persist(this.meta)
        this.members.delete(target.peerId)
        this.buckets.delete(target.peerId)
        this.hooks.close(target.peerId, 4003, 'Removed by the host')
        this.changed()
        return
      }
      case 'transfer-master': {
        const target = this.members.get(message.peerId)
        if (!isMaster || !target || target.peerId === member.peerId || target.status !== 'connected') throw fail(403, 'forbidden')
        this.masterPeerId = target.peerId
        this.meta.masterAccountId = target.accountId
        this.hooks.persist(this.meta)
        this.changed()
        return
      }
      default:
        throw fail(400, 'invalid_message')
    }
  }

  /** Applies timeouts. Returns true once a closed room is old enough to delete. */
  tick(now) {
    this.prunePending(now)
    if (this.closed) return now - this.meta.closedAt >= CLOSED_RETENTION_MS
    if (now - this.meta.createdAt >= ROOM_LIFETIME_MS || (this.masterLostAt && now - this.masterLostAt >= MASTER_GRACE_MS)) {
      this.closeRoom(now)
    }
    return false
  }

  nextDeadline() {
    if (this.closed) return this.meta.closedAt + CLOSED_RETENTION_MS
    const lifetime = this.meta.createdAt + ROOM_LIFETIME_MS
    return this.masterLostAt ? Math.min(lifetime, this.masterLostAt + MASTER_GRACE_MS) : lifetime
  }
}

/** The Durable Object. Requests reach it only from the Worker, which sets `x-room-id` after authenticating. */
export class MultiplayerRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sockets = new Map()
    this.core = undefined
    this.loaded = false
  }

  hooks() {
    return {
      send: (peerId, message) => {
        try { this.sockets.get(peerId)?.send(JSON.stringify(message)) } catch {}
      },
      close: (peerId, code, reason) => {
        const socket = this.sockets.get(peerId)
        this.sockets.delete(peerId)
        try { socket?.close(code, reason) } catch {}
      },
      persist: (meta) => { void this.state.storage.put('meta', meta) },
    }
  }

  async load(roomId) {
    if (!this.loaded) {
      const meta = await this.state.storage.get('meta')
      if (meta) {
        this.core = new RoomCore(roomId, meta, this.hooks())
        // Sockets do not survive eviction, so restart the host's reconnect grace instead of trusting stale timing.
        this.core.masterLostAt = Date.now()
      }
      this.loaded = true
    }
    return this.core
  }

  async schedule() {
    if (this.core) await this.state.storage.setAlarm(this.core.nextDeadline())
  }

  async alarm() {
    if (!this.core) return
    if (this.core.tick(Date.now())) {
      await this.state.storage.deleteAll()
      this.core = undefined
      return
    }
    await this.schedule()
  }

  async fetch(request) {
    const roomId = request.headers.get('x-room-id') ?? ''
    if (!ROOM_ID.test(roomId)) return json({ error: 'not_found' }, 404)
    const secret = this.env.ROOM_TICKET_SECRET
    if (!secret) return json({ error: 'multiplayer_unconfigured' }, 503)
    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/socket') return await this.connect(request, roomId, secret)
      const body = await request.json().catch(() => { throw fail(400, 'invalid_request') })
      if (pathname === '/admit') return json(await this.admit(roomId, body, secret))
      if (pathname === '/close') return json(await this.close(roomId, body))
      return json({ error: 'not_found' }, 404)
    } catch (e) {
      if (e?.status) return json({ error: e.code, message: e.code }, e.status)
      return json({ error: 'internal_error', message: 'internal_error' }, 500)
    }
  }

  async admit(roomId, body, secret) {
    const now = Date.now()
    let core = await this.load(roomId)
    if (body.action === 'create') {
      if (core) throw fail(409, 'room_exists')
    } else if (!core) {
      if (!body.createIfMissing) throw fail(404, 'room_not_found')
    }
    if (core?.tick(now)) {
      await this.state.storage.deleteAll()
      core = this.core = undefined
    }
    if (!core) {
      core = this.core = RoomCore.create(roomId, { accountId: body.accountId, maxPeers: body.maxPeers }, now, this.hooks())
    }
    const seat = core.admit(body.accountId, body.displayName, now)
    await this.schedule()
    const ticket = await signTicket(secret, { r: roomId, p: seat.peerId, a: body.accountId, e: seat.expiresAt })
    return {
      roomId,
      roomSessionId: seat.roomSessionId,
      ticket,
      peerId: seat.peerId,
      expiresAt: new Date(seat.expiresAt).toISOString(),
      role: seat.role,
      maxPeers: seat.maxPeers,
    }
  }

  async close(roomId, body) {
    const core = await this.load(roomId)
    if (!core || core.closed) throw fail(404, 'room_not_found')
    if (core.meta.masterAccountId !== body.accountId) throw fail(403, 'forbidden')
    core.closeRoom(Date.now())
    await this.schedule()
    return { closed: true }
  }

  async connect(request, roomId, secret) {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'upgrade_required' }, 426)
    const now = Date.now()
    const claims = await verifyTicket(secret, new URL(request.url).searchParams.get('ticket'), now)
    const core = await this.load(roomId)
    if (!claims || claims.r !== roomId) return json({ error: 'invalid_ticket' }, 401)
    if (!core) return json({ error: 'room_not_found' }, 404)
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()
    // A replayed ticket must not displace the live socket that already owns this peer id.
    const previous = this.sockets.get(claims.p)
    try {
      this.sockets.set(claims.p, server)
      core.attach(claims.p, claims.a, now)
    } catch (e) {
      if (previous) this.sockets.set(claims.p, previous)
      else this.sockets.delete(claims.p)
      server.close(e?.status === 404 ? 4000 : 4003, e?.code ?? 'rejected')
      return new Response(null, { status: 101, webSocket: client })
    }
    server.addEventListener('message', (event) => this.core?.message(claims.p, event.data, Date.now()))
    const gone = () => {
      if (this.sockets.get(claims.p) === server) this.sockets.delete(claims.p)
      this.core?.detach(claims.p, Date.now())
      void this.schedule()
    }
    server.addEventListener('close', gone)
    server.addEventListener('error', gone)
    await this.schedule()
    return new Response(null, { status: 101, webSocket: client })
  }
}

function roomStub(env, roomId) {
  return env.MULTIPLAYER_ROOMS.get(env.MULTIPLAYER_ROOMS.idFromName(roomId))
}

async function callRoom(env, roomId, path, body, request) {
  const headers = new Headers(request?.headers)
  headers.set('x-room-id', roomId)
  const init = request
    ? { method: request.method, headers }
    : { method: 'POST', headers, body: JSON.stringify(body) }
  return roomStub(env, roomId).fetch(new Request(`https://room${path}${request ? new URL(request.url).search : ''}`, init))
}

function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('')
}

/** Cloudflare Realtime TURN when configured; Vardrynn-operated STUN only otherwise. */
export async function iceServers(env) {
  const stuns = (env.STUN_URLS || 'stun:stun.cloudflare.com:3478').split(',').map((s) => s.trim()).filter(Boolean)
  const ttl = 3600
  const result = { stuns, ttl, servers: [] }
  if (env.TURN_KEY_ID && env.TURN_API_TOKEN) {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${env.TURN_API_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl }),
      },
    )
    if (!response.ok) throw fail(503, 'relay_unavailable')
    const body = await response.json()
    for (const server of body.iceServers ?? []) {
      const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((u) => typeof u === 'string')
      if (server.credential && server.username && urls.some((u) => /^turns?:/.test(u))) {
        result.servers.push({ urls: urls.filter((u) => /^turns?:/.test(u)), username: server.username, credential: server.credential })
      }
    }
    if (result.servers.length) result.turnSessionId = crypto.randomUUID()
  }
  return result
}

async function limited(env, key) {
  if (!env.MULTIPLAYER_RATE_LIMITER) return false
  const { success } = await env.MULTIPLAYER_RATE_LIMITER.limit({ key })
  return !success
}

/**
 * Returns a Response for multiplayer routes, or undefined when the path is not one.
 * `authenticate(request, env, now)` resolves a Bearer session to `{ accountId }`.
 */
export async function handleMultiplayerRoute(request, env, pathname, authenticate, now = Date.now()) {
  const match = /^\/v1\/multiplayer\/rooms(?:\/([^/]+)(?:\/(join|socket))?)?$/.exec(pathname)
  if (!match && pathname !== '/v1/rtc/official') return undefined
  const requestId = crypto.randomUUID()
  const method = request.method
  const url = new URL(request.url)
  try {
    if (!env.DB || !env.MULTIPLAYER_ROOMS || !env.ROOM_TICKET_SECRET) return json({ error: 'multiplayer_unconfigured', message: 'multiplayer_unconfigured', requestId }, 503)
    const [, rawId, action] = match ?? []
    if (action === 'socket') {
      if (method !== 'GET') throw fail(405, 'method_not_allowed')
      if (!ROOM_ID.test(rawId)) throw fail(404, 'room_not_found')
      return await callRoom(env, rawId, '/socket', undefined, request)
    }
    const auth = await authenticate(request, env, now)
    if (await limited(env, `${auth.accountId}`)) {
      const response = json({ error: 'rate_limited', message: 'rate_limited', requestId }, 429)
      response.headers.set('retry-after', '60')
      return response
    }
    const body = async () => {
      const value = await request.json().catch(() => { throw fail(400, 'invalid_request') })
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'invalid_request')
      return value
    }
    const origin = env.PUBLIC_ORIGIN || url.origin
    const admission = async (roomId, payload) => {
      const response = await callRoom(env, roomId, '/admit', { ...payload, accountId: auth.accountId })
      const result = await response.json()
      if (!response.ok) return json({ ...result, requestId }, response.status)
      return json({ ...result, socketUrl: `${origin}/v1/multiplayer/rooms/${roomId}/socket` })
    }
    if (pathname === '/v1/rtc/official') {
      if (method !== 'POST') throw fail(405, 'method_not_allowed')
      return json(await iceServers(env))
    }
    if (!rawId && method === 'POST') {
      const b = await body()
      return admission(newRoomId(), { action: 'create', displayName: b.displayName, maxPeers: b.maxPeers })
    }
    if (rawId && !ROOM_ID.test(rawId)) throw fail(404, 'room_not_found')
    if (rawId && action === 'join' && method === 'POST') {
      const b = await body()
      return admission(rawId, { action: 'join', displayName: b.displayName, createIfMissing: b.createIfMissing === true })
    }
    if (rawId && !action && method === 'DELETE') {
      const response = await callRoom(env, rawId, '/close', { accountId: auth.accountId })
      const result = await response.json()
      return response.ok ? new Response(null, { status: 204 }) : json({ ...result, requestId }, response.status)
    }
    throw fail(405, 'method_not_allowed')
  } catch (e) {
    if (e?.status) return json({ error: e.code, message: e.code, requestId }, e.status)
    return json({ error: 'internal_error', message: 'internal_error', requestId }, 500)
  }
}
