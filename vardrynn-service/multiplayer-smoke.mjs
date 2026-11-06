// Two-client smoke test for the multiplayer service. Run against a local `wrangler dev` or a dev deployment:
//   BASE=http://localhost:8799 TOKEN_A=... TOKEN_B=... node vardrynn-service/multiplayer-smoke.mjs
// Each token is a Bearer access token of a different account. Exits non-zero on the first failed check.
const { BASE, TOKEN_A, TOKEN_B } = process.env
if (!BASE || !TOKEN_A || !TOKEN_B) throw new Error('BASE, TOKEN_A and TOKEN_B are required')

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}
const api = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : undefined }
}

class Client {
  constructor(name) { this.name = name; this.messages = []; this.closed = null }
  open(admission) {
    this.state = null
    this.closed = null
    const url = new URL(admission.socketUrl.replace(/^http/, 'ws'))
    url.searchParams.set('ticket', admission.ticket)
    this.ws = new WebSocket(url)
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      this.messages.push(m)
      if (m.type === 'room-state') this.state = m
    }
    this.ws.onclose = (e) => { this.closed = { code: e.code, reason: e.reason } }
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = () => reject(new Error(`${this.name} socket error`))
    })
  }
  send(m) { this.ws.send(JSON.stringify(m)) }
  async until(label, fn, ms = 5000) {
    const end = Date.now() + ms
    while (Date.now() < end) { if (fn(this)) return true; await new Promise((r) => setTimeout(r, 25)) }
    console.log(`  timeout waiting for ${this.name}: ${label}`)
    return false
  }
  nextOf(type, from = 0) { return this.messages.slice(from).find((m) => m.type === type) }
}

const sdp = (sdpType) => ({ type: 'signal', receiver: undefined, payload: { sdp: 'v=0\r\n', sdpType, session: 's1', candidates: [{ candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', mid: '0' }] } })

const A = new Client('A'), B = new Client('B')

// ICE servers
const ice = await api(TOKEN_A, 'POST', '/v1/rtc/official')
check('ICE servers issued', ice.status === 200 && Array.isArray(ice.body.iceServers ?? ice.body.servers ?? ice.body), `status ${ice.status}`)

// Create + connect host
const created = await api(TOKEN_A, 'POST', '/v1/multiplayer/rooms', { displayName: 'Alice' })
check('A creates room', created.status === 200 && created.body.role === 'master' && /^[A-Z2-9]{10}$/.test(created.body.roomId), `${created.status} ${created.body.roomId}`)
const roomId = created.body.roomId
await A.open(created.body)
check('A gets room-state as master', await A.until('state', (c) => c.state?.masterPeerId === c.state?.selfPeerId && c.state?.members.length === 1))

// Join
const joinB = await api(TOKEN_B, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, { displayName: 'Bob' })
check('B joins room', joinB.status === 200 && joinB.body.role !== 'master', `${joinB.status}`)
await B.open(joinB.body)
check('both see 2 members', await A.until('2 members', (c) => c.state?.members.length === 2) && await B.until('2 members', (c) => c.state?.members.length === 2))
check('B sees A as master', B.state?.masterPeerId === A.state?.selfPeerId)

// Ticket is single use
const reuse = new WebSocket(`${joinB.body.socketUrl.replace(/^http/, 'ws')}?ticket=${joinB.body.ticket}`)
const reuseResult = await new Promise((res) => { reuse.onclose = (e) => res(e.code); reuse.onerror = () => res('error') })
check('used ticket cannot be replayed', reuseResult === 4003 || reuseResult === 'error', reuseResult)

// Signaling relay
const cursorB = B.messages.length, cursorA = A.messages.length
const offer = sdp('offer'); offer.receiver = B.state.selfPeerId
A.send(offer)
check('B receives A offer', await B.until('signal', (c) => c.nextOf('signal', cursorB)), '')
const got = B.nextOf('signal', cursorB)
check('signal sender is A, payload rebuilt', got?.sender === A.state.selfPeerId && got.payload.sdpType === 'offer')
B.send(sdp('answer'))
check('A receives B answer', await A.until('signal', (c) => c.nextOf('signal', cursorA)) && A.nextOf('signal', cursorA).sender === B.state.selfPeerId)
B.send({ type: 'rtc-state', state: 'connected' })
check('rtc-state reaches host', await A.until('connected', (c) => c.state?.members.find((m) => m.peerId === B.state.selfPeerId)?.status === 'connected'))

// Invalid receiver / oversize
const before = B.messages.length
B.send({ type: 'signal', receiver: 'nobody', payload: {} })
check('bad message returns error', await B.until('error', (c) => c.nextOf('error', before)))

// Member network drop -> reconnect
const bPeer = B.state.selfPeerId
B.ws.close()
check('A sees B leave or disconnect', await A.until('b gone', (c) => !c.state.members.some((m) => m.peerId === bPeer && m.status === 'connected')))
const rejoinB = await api(TOKEN_B, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, { displayName: 'Bob' })
check('B re-admitted after drop', rejoinB.status === 200, `${rejoinB.status} ${rejoinB.body?.error ?? ''}`)
await B.open(rejoinB.body)
check('B back in room, A sees 2 members', await B.until('state', (c) => c.state?.members.length === 2) && await A.until('2', (c) => c.state.members.length === 2))

// Host drop -> waiting-master -> host returns
A.ws.close()
check('room waits for master', await B.until('waiting', (c) => c.state?.status === 'waiting-master'))
const rejoinA = await api(TOKEN_A, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, { displayName: 'Alice' })
check('A re-admitted as master', rejoinA.status === 200 && rejoinA.body.role === 'master', `${rejoinA.status}`)
await A.open(rejoinA.body)
check('room open again', await B.until('open', (c) => c.state?.status === 'open') && await A.until('open', (c) => c.state?.status === 'open'))

// Non-master cannot close; capacity/unknown room errors
const forbidden = await api(TOKEN_B, 'DELETE', `/v1/multiplayer/rooms/${roomId}`)
check('member cannot close room', forbidden.status === 403, `${forbidden.status}`)
const missing = await api(TOKEN_B, 'POST', '/v1/multiplayer/rooms/ZZZZZZZZZZ/join', {})
check('unknown room -> 404', missing.status === 404, `${missing.status}`)
const unauth = await fetch(BASE + '/v1/multiplayer/rooms', { method: 'POST', body: '{}' })
check('no token -> 401', unauth.status === 401)

// Host removes member, member cannot rejoin
A.send({ type: 'remove-member', peerId: B.state.selfPeerId })
check('B closed with 4003', await B.until('closed', (c) => c.closed?.code === 4003), JSON.stringify(B.closed))
const kicked = await api(TOKEN_B, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, {})
check('removed member cannot rejoin', kicked.status === 403, `${kicked.status} ${kicked.body?.error ?? ''}`)

// Close room
const closed = await api(TOKEN_A, 'DELETE', `/v1/multiplayer/rooms/${roomId}`)
check('host closes room (204)', closed.status === 204, `${closed.status}`)
check('A socket closed 4000', await A.until('closed', (c) => c.closed?.code === 4000), JSON.stringify(A.closed))
const after = await api(TOKEN_A, 'POST', `/v1/multiplayer/rooms/${roomId}/join`, {})
check('closed room cannot be joined', after.status >= 400, `${after.status} ${after.body?.error ?? ''}`)

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
