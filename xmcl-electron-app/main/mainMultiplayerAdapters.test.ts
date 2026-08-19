import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMainLocalNetwork, createMainSharedFiles } from './mainMultiplayerAdapters'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()))
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
