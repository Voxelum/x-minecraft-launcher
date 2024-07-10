import { readFile } from 'fs/promises'
import { join } from 'path'
import { PeerConnectionFactory } from './PeerConnectionFactory'

const BUILTIN = [
  'stun.voipbuster.com:3478',
  'stun.voipstunt.com:3478',
  'stun.internetcalls.com:3478',
  'stun.voip.aebc.com:3478',
  'stun.qq.com:3478',
  'stun.l.google.com:19302',
  'stun2.l.google.com:19302',
  'stun3.l.google.com:19302',
  'stun4.l.google.com:19302',
].map(s => ({
  urls: `stun:${s}`,
}))

export async function getIceServers() {
  console.log('Try to fetch rtc credential')
  const response = await fetch(
    'https://api.xmcl.app/rtc/official',
    {
      method: 'POST',
    })
  if (response.status === 200) {
    const credential: {
      uris: string[]
      ttl: number
      password: string
      username: string
      stuns: string[]
      meta: Record<string, string>
    } | {
      stuns: string[]
    } = await response.json() as any
    const result: RTCIceServer[] = credential.stuns.map((s) => ({
      urls: `stun:${s}`,
    }))

    if ('uris' in credential && credential.uris) {
      for (const uri of credential.uris) {
        result.unshift({
          urls: uri,
          username: credential.username,
          credential: credential.password,
        })
      }
    }

    return {
      servers: result,
      meta: 'meta' in credential ? credential.meta : undefined,
    }
  } else {
    return {
      servers: [],
    }
  }
}

export async function loadIceServers(cachePath: string) {
  try {
    console.log('Try to load ice servers from cache', cachePath)
    const content = await readFile(join(cachePath, 'ice-servers.json'), 'utf-8')
    const caches = JSON.parse(content)
    if (caches instanceof Array && caches.length > 0) {
      console.log('Load ice servers from cache', caches)
      return caches
        .filter(v => typeof v === 'object')
        .map((v: object) => {
          if ('hostname' in v) {
            const vv = v as any
            return {
              urls: `stun:${vv.hostname}:${vv.port}`,
            } as RTCIceServer
          }
          return v as RTCIceServer
        })
    }
    return []
  } catch (e) {
    console.error(e as any)
    return []
  }
}

async function test(factory: PeerConnectionFactory, iceServer: RTCIceServer, portBegin?: number) {
  const co = await factory.createConnection(iceServer, portBegin)
  return new Promise<string[]>((resolve) => {
    const ips = new Set<string>()
    co.onicegatheringstatechange = (s) => {
      if (co.iceGatheringState === 'complete') {
        resolve([...ips])
        chan.close()
        co.close()
      }
    }
    co.onicecandidate = (ev) => {
      const candidate = ev.candidate
      if (candidate && candidate.type === 'srflx') {
        // parse candidate for public ip
        const ip = candidate.candidate.split(' ')[4]
        ips.add(ip)
      }
    }
    const chan = co.createDataChannel('test', { protocol: 'test' })
    co.createOffer().then((offer) => {
      co.setLocalDescription(offer)
    })
  })
}

export function getKey(server: RTCIceServer) {
  return typeof server.urls === 'string' ? server.urls : server.urls.join(',')
}

async function testIceServers(
  factory: PeerConnectionFactory,
  servers: RTCIceServer[],
  passed: Record<string, RTCIceServer>,
  blocked: Record<string, RTCIceServer>,
  onValidIceServer: (server: RTCIceServer) => void,
  onIp: (ip: string) => void,
  portBegin?: number) {
  const ipSet = new Set<string>()
  await Promise.all(servers.map(async (server) => {
    if (server.credential) {
      const key = getKey(server)
      passed[getKey(server)] = server
      delete blocked[key]
      onValidIceServer(server)
      return
    }
    const ips = await test(factory, server, portBegin).catch(() => [])
    console.log('Test ice server', server, ips)
    const key = getKey(server)
    if (ips.length > 0) {
      passed[key] = server
      delete blocked[key]
      onValidIceServer(server)
      for (const ip of ips) {
        if (!ipSet.has(ip)) {
          ipSet.add(ip)
          onIp(ip)
        }
      }
    } else {
      blocked[key] = server
      delete passed[key]
    }
  }))
}

const isSameRTCServer = (a: RTCIceServer, b: RTCIceServer) => {
  return getKey(a) === getKey(b)
}

export function createIceServersProvider(
  factory: PeerConnectionFactory,
  onValidIceServer: (server: RTCIceServer) => void,
  onIp: (ip: string) => void,
  onMeta: (meta: Record<string, string>) => void,
) {
  const passed: Record<string, RTCIceServer> = {}
  const blocked: Record<string, RTCIceServer> = {}

  let _resolve = () => { }
  const initPromise: Promise<void> = new Promise((resolve) => {
    _resolve = resolve
  })

  return {
    whenReady() {
      return initPromise
    },
    async init(cachePath: string) {
      console.log('Init ice servers')
      loadIceServers(cachePath).then(cached => {
        const all = [...cached, ...BUILTIN]
        const pending: Record<string, any> = {}
        for (const a of all) {
          pending[getKey(a)] = a
        }
        console.log('Start to test ice servers')
        testIceServers(factory, Object.values(pending), passed, blocked, onValidIceServer, onIp)
        _resolve()
      }, _resolve)
    },
    async update() {
      const { servers, meta } = await getIceServers()
      if (meta) {
        onMeta(meta)
      }
      testIceServers(factory, servers, passed, blocked, onValidIceServer, onIp)
    },
    get(preferredIceServers: RTCIceServer[] = []) {
      const servers = Object.keys(passed).length > 0 ? Object.values(passed) : Object.values(blocked)
      // sort all servers by preferredIceServers
      if (preferredIceServers.length > 0) {
        servers.sort((a, b) => {
          const aIndex = preferredIceServers.findIndex((v) => isSameRTCServer(v, a))
          const bIndex = preferredIceServers.findIndex((v) => isSameRTCServer(v, b))
          if (aIndex === -1 && bIndex === -1) {
            return 0
          }
          if (aIndex === -1) {
            return 1
          }
          if (bIndex === -1) {
            return -1
          }
          return aIndex - bIndex
        })
      }

      const turns = servers.filter((s) => typeof s.urls === 'string' ? s.urls.startsWith('turn') : s.urls.some((u) => u.startsWith('turn')))
      const stuns = servers.filter((s) => typeof s.urls === 'string' ? s.urls.startsWith('stun') : s.urls.some((u) => u.startsWith('stun')))

      return [stuns, turns]
    },
  }
}
