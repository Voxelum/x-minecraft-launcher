import { describe, expect, test, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createNodeInstallRuntime,
  executeInstallWorkflow,
  executeInstallManifest,
  type InstallFile,
  type InstallEvent,
  type InstallManifest,
  type InstallRuntime,
  type JavaCommand,
} from './installManifest'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((result) => { resolve = result })
  return { promise, resolve }
}

function createRuntime(files = new Map<string, { content: string; mtimeMs: number }>()) {
  const downloads: InstallFile[][] = []
  const commands: JavaCommand[] = []
  const runtime: InstallRuntime = {
    stat: async (path) => {
      const file = files.get(path)
      return file ? { size: file.content.length, mtimeMs: file.mtimeMs } : undefined
    },
    checksum: async (path) => files.get(path)?.content ?? '',
    download: async (targets) => {
      downloads.push(targets)
      for (const target of targets) files.set(target.path, { content: target.checksum?.value ?? 'downloaded', mtimeMs: 200 })
    },
    java: async (command) => { commands.push(command) },
    materialize: async (operations) => {
      const previous = new Map(operations.map((operation) => [operation.path, files.get(operation.path)]))
      for (const operation of operations) {
        if (operation.type === 'remove') files.delete(operation.path)
        else if (operation.type === 'write') {
          files.set(operation.path, { content: operation.content, mtimeMs: 200 })
        }
      }
      return {
        commit: async () => {},
        rollback: async () => {
          for (const [path, value] of previous) {
            if (value) files.set(path, value)
            else files.delete(path)
          }
        },
      }
    },
    remove: async (paths) => { for (const path of paths) files.delete(path) },
    validate: async (path) => files.has(path),
  }
  return { runtime, files, downloads, commands }
}

describe('install manifest executor', () => {
  test('implements timestamp-aware file diagnosis without unnecessary checksums', async () => {
    const { runtime, files, downloads } = createRuntime(new Map([
      ['unchanged', { content: 'unknown', mtimeMs: 100 }],
      ['changed-valid', { content: 'expected', mtimeMs: 101 }],
      ['changed-invalid', { content: 'wrong', mtimeMs: 101 }],
      ['legacy-valid', { content: 'expected', mtimeMs: 1 }],
    ]))
    const checksum = vi.spyOn(runtime, 'checksum')
    const plan: InstallManifest = {
      schemaVersion: 1,
      tasks: [{
        id: 'files',
        type: 'files',
        files: [
          { path: 'missing', urls: ['missing'], checksum: { algorithm: 'sha1', value: 'expected' } },
          { path: 'unchanged', urls: ['unchanged'], validatedAt: 100, checksum: { algorithm: 'sha1', value: 'expected' } },
          { path: 'changed-valid', urls: ['changed-valid'], validatedAt: 100, checksum: { algorithm: 'sha1', value: 'expected' } },
          { path: 'changed-invalid', urls: ['changed-invalid'], validatedAt: 100, checksum: { algorithm: 'sha1', value: 'expected' } },
          { path: 'legacy-valid', urls: ['legacy-valid'], checksum: { algorithm: 'sha1', value: 'expected' } },
        ],
      }],
    }

    await executeInstallManifest(plan, runtime)

    expect(downloads).toHaveLength(1)
    expect(downloads[0].map((file) => file.path)).toEqual(['missing', 'changed-invalid'])
    expect(checksum.mock.calls.map(([path]) => path)).not.toContain('unchanged')
    expect(files.get('changed-invalid')?.content).toBe('expected')
  })

  test('trusts existing size only before download and checksums downloaded content', async () => {
    const { runtime, files, downloads } = createRuntime(new Map([
      ['cached-asset', { content: 'same-size', mtimeMs: 200 }],
    ]))
    const checksum = vi.spyOn(runtime, 'checksum')
    let attempt = 0
    runtime.download = async (targets) => {
      downloads.push(targets)
      attempt += 1
      files.set('missing-asset', {
        content: attempt === 1 ? 'bad!' : 'good',
        mtimeMs: 200,
      })
    }

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'assets',
        type: 'files',
        files: [
          {
            path: 'cached-asset',
            urls: ['cached-asset'],
            size: 9,
            checksum: { algorithm: 'sha1', value: 'different' },
            trustExistingSize: true,
          },
          {
            path: 'missing-asset',
            urls: ['missing-asset'],
            size: 4,
            checksum: { algorithm: 'sha1', value: 'good' },
            trustExistingSize: true,
          },
        ],
      }],
    }, runtime)

    expect(downloads).toHaveLength(2)
    expect(checksum.mock.calls.map(([path]) => path)).not.toContain('cached-asset')
    expect(files.get('missing-asset')?.content).toBe('good')
  })

  test('dispatches all independent file and Java tasks immediately', async () => {
    const starts: string[] = []
    const files = deferred<void>()
    const java = deferred<void>()
    const { runtime, files: state } = createRuntime()
    runtime.download = async () => {
      starts.push('files')
      await files.promise
      state.set('a', { content: 'a', mtimeMs: 200 })
    }
    runtime.java = async () => {
      starts.push('java')
      await java.promise
      state.set('output', { content: 'output', mtimeMs: 200 })
    }
    const execution = executeInstallManifest({
      schemaVersion: 1,
      tasks: [
        { id: 'files', type: 'files', files: [{ path: 'a', urls: ['a'] }] },
        {
          id: 'java',
          type: 'java',
          strategies: [[{ executable: 'java', args: [] }]],
          outputs: [{ path: 'output' }],
        },
      ],
    }, runtime)

    await vi.waitFor(() => expect(starts).toEqual(['files', 'java']))
    files.resolve()
    java.resolve()
    await expect(execution).resolves.toBeDefined()
  })

  test('retries a checksum-invalid download and only reports success after verification', async () => {
    const { runtime, files } = createRuntime()
    let attempt = 0
    runtime.download = async ([file]) => {
      attempt += 1
      files.set(file.path, { content: attempt === 1 ? 'wrong' : 'expected', mtimeMs: 200 })
    }

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'file',
        type: 'files',
        files: [{ path: 'file', urls: ['file'], checksum: { algorithm: 'sha1', value: 'expected' } }],
      }],
    }, runtime)

    expect(attempt).toBe(2)
  })

  test('backs off and recovers after repeated connection resets', async () => {
    const { runtime, files } = createRuntime()
    const waits: number[] = []
    const events: InstallEvent[] = []
    let attempt = 0
    runtime.download = async ([file]) => {
      attempt += 1
      if (attempt < 4) throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
      files.set(file.path, { content: 'expected', mtimeMs: 200 })
    }

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'installer',
        type: 'files',
        files: [{ path: 'installer.jar', urls: ['mirror', 'official'], checksum: { algorithm: 'sha1', value: 'expected' } }],
      }],
    }, runtime, {
      random: () => 0.5,
      wait: async (delay) => { waits.push(delay) },
      onEvent: (event) => events.push(event),
    })

    expect(attempt).toBe(4)
    expect(waits).toEqual([500, 1_000, 2_000])
    expect(events.filter((event) => event.type === 'file-retry')).toMatchObject([
      { attempt: 1, delay: 500, pending: 1 },
      { attempt: 2, delay: 1_000, pending: 1 },
      { attempt: 3, delay: 2_000, pending: 1 },
    ])
  })

  test('does not retry local non-recoverable errors', async () => {
    const { runtime } = createRuntime()
    const download = vi.fn(async () => {
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    })
    runtime.download = download

    await expect(executeInstallManifest({
      schemaVersion: 1,
      tasks: [{ id: 'file', type: 'files', files: [{ path: 'file', urls: ['file'] }] }],
    }, runtime, { wait: async () => {} })).rejects.toMatchObject({ code: 'ENOSPC' })

    expect(download).toHaveBeenCalledTimes(1)
  })

  test('advances to the next source after a checksum-invalid download', async () => {
    const { runtime, files } = createRuntime()
    const attempted: string[] = []
    runtime.download = async ([file]) => {
      attempted.push(file.urls[0])
      files.set(file.path, {
        content: file.urls[0] === 'official' ? 'expected' : 'wrong',
        mtimeMs: 200,
      })
    }

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'file',
        type: 'files',
        files: [{
          path: 'file',
          urls: ['mirror', 'official'],
          checksum: { algorithm: 'sha1', value: 'expected' },
        }],
      }],
    }, runtime)

    expect(attempted).toEqual(['mirror', 'official'])
  })

  test('falls back from one Java strategy to another and validates outputs', async () => {
    const { runtime, files, commands } = createRuntime()
    const events: InstallEvent[] = []
    runtime.java = async (command) => {
      commands.push(command)
      if (command.args[0] === 'batch') throw new Error('batch failed')
      files.set('output.jar', { content: 'valid', mtimeMs: 200 })
    }

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'postprocess',
        type: 'java',
        strategies: [
          [{ executable: 'java', args: ['batch'] }],
          [
            { executable: 'java', args: ['processor-1'] },
            { executable: 'java', args: ['processor-2'] },
          ],
        ],
        outputs: [{ path: 'output.jar', checksum: { algorithm: 'sha1', value: 'valid' }, validator: 'zip' }],
      }],
    }, runtime, { onEvent: (event) => events.push(event) })

    expect(commands.map((command) => command.args[0])).toEqual(['batch', 'processor-1', 'processor-2'])
    expect(events
      .filter((event) => event.type.startsWith('java-strategy'))
      .map((event) => [event.type, 'strategy' in event ? event.strategy : undefined]))
      .toEqual([
        ['java-strategy-start', 0],
        ['java-strategy-failed', 0],
        ['java-strategy-start', 1],
      ])
  })

  test('aborts Java launched by the default Node runtime', async () => {
    const controller = new AbortController()
    const execution = executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'java',
        type: 'java',
        strategies: [[{
          executable: process.execPath,
          args: ['-e', 'setTimeout(() => {}, 10_000)'],
        }]],
        outputs: [],
      }],
    }, createNodeInstallRuntime({ signal: controller.signal }))

    controller.abort()

    await expect(execution).rejects.toMatchObject({ name: 'AbortError' })
  })

  test('executes workflow stages until the workflow reports done', async () => {
    const { runtime, files } = createRuntime()
    let stage = 0
    const result = await executeInstallWorkflow({
      async next() {
        if (stage++ === 0) {
          return {
            done: false as const,
            plan: {
              schemaVersion: 1 as const,
              tasks: [{ id: 'metadata', type: 'files' as const, files: [{ path: 'metadata', urls: ['metadata'] }] }],
            },
          }
        }
        expect(files.has('metadata')).toBe(true)
        return { done: true as const, result: 'installed' }
      },
    }, runtime)

    expect(result).toBe('installed')
    expect(stage).toBe(2)
  })

  test('materializes generic files after dependencies', async () => {
    const { runtime, files } = createRuntime()
    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [
        { id: 'input', type: 'files', files: [{ path: 'input', urls: ['input'] }] },
        {
          id: 'output',
          type: 'materialize',
          dependsOn: ['input'],
          operations: [{ type: 'write', path: 'output.json', content: '{}' }],
          outputs: [{ path: 'output.json', validator: 'file' }],
        },
      ],
    }, runtime)

    expect(files.has('input')).toBe(true)
    expect(files.get('output.json')?.content).toBe('{}')
  })

  test('executes materialization even when outputs already exist', async () => {
    const { runtime } = createRuntime(new Map([
      ['output', { content: 'valid', mtimeMs: 100 }],
    ]))
    const materialize = vi.spyOn(runtime, 'materialize')

    await executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'layout',
        type: 'materialize',
        operations: [{ type: 'write', path: 'output', content: 'valid' }],
        outputs: [{ path: 'output', checksum: { algorithm: 'sha1', value: 'valid' } }],
      }],
    }, runtime)

    expect(materialize).toHaveBeenCalledOnce()
  })

  test('preserves files when ensuring a parent directory before changing a child', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-materialize-parent-'))
    const bin = join(root, 'bin')
    const executable = join(bin, 'java')
    const sibling = join(bin, 'plain')
    await mkdir(bin)
    await writeFile(executable, 'java')
    await writeFile(sibling, 'plain')
    try {
      await executeInstallManifest({
        schemaVersion: 1,
        tasks: [{
          id: 'layout',
          type: 'materialize',
          operations: [
            { type: 'ensure-directory', path: bin },
            { type: 'chmod', path: executable, mode: 0o755 },
          ],
          outputs: [{ path: executable, size: 4 }],
        }],
      }, createNodeInstallRuntime())

      await expect(readFile(sibling, 'utf8')).resolves.toBe('plain')
      await expect(stat(executable)).resolves.toBeDefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('keeps the previous target when materialization fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-materialize-'))
    const target = join(root, 'target.jar')
    await writeFile(target, 'original')
    try {
      await expect(executeInstallManifest({
        schemaVersion: 1,
        tasks: [{
          id: 'copy',
          type: 'materialize',
          operations: [{ type: 'copy', source: join(root, 'missing.jar'), path: target }],
          outputs: [{ path: target, size: 100, validator: 'file' }],
        }],
      }, createNodeInstallRuntime())).rejects.toThrow()

      await expect(readFile(target, 'utf8')).resolves.toBe('original')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rolls back every target when one materialized output is invalid', async () => {
    const { runtime, files } = createRuntime(new Map([
      ['a', { content: 'old-a', mtimeMs: 100 }],
      ['b', { content: 'old-b', mtimeMs: 100 }],
    ]))

    await expect(executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'transaction',
        type: 'materialize',
        operations: [
          { type: 'write', path: 'a', content: 'new-a' },
          { type: 'write', path: 'b', content: 'new-b' },
        ],
        outputs: [
          { path: 'a', checksum: { algorithm: 'sha1', value: 'new-a' } },
          { path: 'b', checksum: { algorithm: 'sha1', value: 'expected-b' } },
        ],
      }],
    }, runtime)).rejects.toThrow('invalid output')

    expect(files.get('a')?.content).toBe('old-a')
    expect(files.get('b')?.content).toBe('old-b')
  })
})