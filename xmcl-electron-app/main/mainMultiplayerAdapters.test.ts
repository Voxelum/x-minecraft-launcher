import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createMainLocalNetwork, createMainSharedFiles } from './mainMultiplayerAdapters'

const lanMocks = vi.hoisted(() => ({
  bindErrors: new Map<'udp4' | 'udp6', Error>(),
  instances: [] as Array<{
    family: 'udp4' | 'udp6'
    listener?: (server: { motd: string; port: number }) => void
    bind: Mock<() => Promise<void>>
    broadcast: Mock<(server: { motd: string; port: number }) => Promise<number>>
    destroy: Mock<() => Promise<void>>
  }>,
}))

vi.mock('@xmcl/client', () => ({
  MinecraftLanDiscover: class {
    readonly instance: (typeof lanMocks.instances)[number]

    constructor(family: 'udp4' | 'udp6') {
      const bindError = lanMocks.bindErrors.get(family)
      this.instance = {
        family,
        bind: bindError
          ? vi.fn().mockRejectedValue(bindError)
          : vi.fn().mockResolvedValue(undefined),
        broadcast: vi.fn().mockResolvedValue(1),
        destroy: vi.fn().mockResolvedValue(undefined),
      }
      lanMocks.instances.push(this.instance)
    }

    on(_event: 'discover', listener: (server: { motd: string; port: number }) => void) {
      this.instance.listener = listener
    }

    bind() {
      return this.instance.bind()
    }

    broadcast(server: { motd: string; port: number }) {
      return this.instance.broadcast(server)
    }

    destroy() {
      return this.instance.destroy()
    }
  },
}))

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()))
  lanMocks.bindErrors.clear()
  lanMocks.instances.length = 0
})

describe('native multiplayer adapters', () => {
  it('bridges loopback sockets through the shared LocalNetwork contract', async () => {
    const network = createMainLocalNetwork()
    cleanups.push(() => network.dispose())
    const server = await network.listen(31_000, true)
    const received = Promise.withResolvers<string>()
    server.onConnection((socket) => {
      socket.onData((data) => received.resolve(new TextDecoder().decode(data)))
    })
    const client = await network.connect(server.port)

    client.write(new TextEncoder().encode('hello').buffer as ArrayBuffer)

    await expect(received.promise).resolves.toBe('hello')
  })

  it('discovers and broadcasts LAN servers over IPv4 and IPv6', async () => {
    const network = createMainLocalNetwork()
    cleanups.push(() => network.dispose())
    const discovered: Array<{ motd: string; port: number }> = []

    await network.discoverLan((server) => discovered.push(server))
    const server = { motd: 'Test server', port: 25_565 }
    for (const discover of lanMocks.instances) discover.listener?.(server)
    await network.broadcastLan(server)

    expect(lanMocks.instances.map(({ family }) => family).sort()).toEqual(['udp4', 'udp6'])
    expect(discovered).toEqual([server, server])
    expect(lanMocks.instances.every(({ broadcast }) => broadcast.mock.calls[0]?.[0] === server)).toBe(
      true,
    )
  })

  it('keeps LAN discovery available when one address family cannot bind', async () => {
    const errors: Array<{ family: string; error: unknown }> = []
    const network = createMainLocalNetwork((family, error) => errors.push({ family, error }))
    cleanups.push(() => network.dispose())
    lanMocks.bindErrors.set('udp6', new Error('IPv6 unavailable'))

    await network.discoverLan(() => {})

    expect(errors).toMatchObject([{ family: 'udp6', error: new Error('IPv6 unavailable') }])
    expect(lanMocks.instances.find(({ family }) => family === 'udp4')?.bind).toHaveBeenCalledOnce()
  })

  it('only opens allowlisted files below the shared instance root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-native-share-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    await writeFile(join(root, 'allowed.txt'), 'shared content')
    await writeFile(join(root, 'blocked.txt'), 'blocked content')
    const files = createMainSharedFiles()
    await files.share(root, ['allowed.txt'])

    const stream = await files.open('allowed.txt')
    const content = Promise.withResolvers<string>()
    const chunks: Uint8Array[] = []
    stream.onData((data) => chunks.push(new Uint8Array(data)))
    stream.onError(content.reject)
    stream.onClose(() => {
      const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
      const output = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        output.set(chunk, offset)
        offset += chunk.byteLength
      }
      content.resolve(new TextDecoder().decode(output))
    })
    stream.resume()

    await expect(content.promise).resolves.toBe('shared content')
    await expect(files.open('blocked.txt')).rejects.toThrow('multiplayer_shared_file_forbidden')
    await expect(files.open('../allowed.txt')).rejects.toThrow('multiplayer_shared_file_invalid_path')

    await expect(files.share(root, ['../invalid.txt'])).rejects.toThrow(
      'multiplayer_shared_file_invalid_path',
    )
    const stillShared = await files.open('allowed.txt')
    stillShared.close()
  })
})
